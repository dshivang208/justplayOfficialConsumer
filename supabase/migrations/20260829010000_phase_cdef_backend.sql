-- ============================================================================
-- JustPlay — Backend Phases C, D, E, F
-- ============================================================================
-- Run AFTER phase_a_schema.sql + phase-b-auth-patch.sql, same project.
-- Idempotent — safe to re-run.
--
-- What this file adds, by phase:
--   C — atomic slot booking / cancellation (no double-booking, ever)
--   D — columns + tables Razorpay's Edge Functions read/write, refund log
--   E — atomic join/leave for hosted games, groups, event registrations
--   F — referral codes, wallet ledger balance, first-booking reward hook
--
-- Design note used throughout: every "shared counter" (slots.status,
-- hosted_games.spots_filled, groups.member_count, events.participant_count)
-- is changed ONLY inside a SECURITY DEFINER function that takes a row lock
-- first (`for update`, or the implicit lock an UPDATE takes on its own
-- row). Column-level GRANTs are then used to make it impossible for a
-- client to write those columns any other way, so the "atomic write" isn't
-- just a convention the frontend has to remember to follow.
-- ============================================================================

-- ============================================================================
-- C1. Multi-hour bookings: a booking can cover several contiguous slot rows
-- ============================================================================
-- `bookings.slot_id` (Phase A) stays as the anchor/first slot for backward
-- compatibility. This junction table records every slot a booking actually
-- covers, so a 3-hour booking still locks and releases exactly 3 slot rows.

create table if not exists public.booking_slots (
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  slot_id     uuid not null references public.slots (id) on delete restrict,
  primary key (booking_id, slot_id)
);

alter table public.booking_slots enable row level security;

drop policy if exists "booking_slots select own" on public.booking_slots;
create policy "booking_slots select own" on public.booking_slots
  for select using (
    exists (select 1 from public.bookings b where b.id = booking_id and b.user_id = auth.uid())
  );
-- No client insert/update/delete policy — only create_booking() (below) writes this table.

grant select on public.booking_slots to authenticated;

-- ============================================================================
-- C2 / D1. Columns Phase D's payment flow and refund flow need
-- ============================================================================

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'cancelled', 'cancelled_refunded', 'completed'));

alter table public.bookings add column if not exists razorpay_order_id text;

comment on column public.bookings.payment_id is
  'Razorpay payment_id, set once by mark_booking_confirmed() after signature verification.';
comment on column public.bookings.razorpay_order_id is
  'Razorpay order_id, set when the order is created (create-razorpay-order Edge Function).';

-- ============================================================================
-- D2. Refund log — admin-visible record of every refund, without an admin UI
-- ============================================================================

create table if not exists public.refund_log (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references public.bookings (id) on delete cascade,
  user_id               uuid not null references public.users (id) on delete cascade,
  razorpay_payment_id   text,
  razorpay_refund_id    text,
  amount                integer not null,
  status                text not null default 'initiated',
  reason                text,
  created_at            timestamptz not null default now(),

  constraint refund_log_status_check check (status in ('initiated', 'processed', 'failed'))
);

create index if not exists idx_refund_log_booking_id on public.refund_log (booking_id);
create index if not exists idx_refund_log_user_id on public.refund_log (user_id);

alter table public.refund_log enable row level security;

drop policy if exists "refund_log select own" on public.refund_log;
create policy "refund_log select own" on public.refund_log
  for select using (auth.uid() = user_id);
-- No client write policy: only the Razorpay Edge Functions (service role) write this table.

grant select on public.refund_log to authenticated;

-- ============================================================================
-- D3. Payment event audit trail (webhook + client-confirm both land here)
-- ============================================================================
-- Belt-and-suspenders per the brief: "always verify via webhook or
-- server-side signature check". Both paths call the SAME mark_booking_confirmed
-- function below, and both log here, so a duplicate (webhook arrives after
-- the client-driven verify already ran) is visible and inert rather than
-- silently double-processed.

create table if not exists public.payment_events (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid references public.bookings (id) on delete set null,
  source            text not null,                                    -- 'client_verify' | 'webhook'
  razorpay_event    text,
  payload           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),

  constraint payment_events_source_check check (source in ('client_verify', 'webhook'))
);

create index if not exists idx_payment_events_booking_id on public.payment_events (booking_id);

alter table public.payment_events enable row level security;
-- No policies at all: this table is written and read only by Edge Functions
-- using the service role key, which bypasses RLS entirely. It is not part
-- of any client-facing surface.

-- ============================================================================
-- C3. Tighten bookings/slots so counters can ONLY move through functions
-- ============================================================================
-- Phase A's "bookings update own" policy let a signed-in user rewrite their
-- own price_paid/status/etc. That's closed off here per the comment already
-- left in Phase A: all legitimate mutation now goes through
-- create_booking() / cancel_booking() / mark_booking_confirmed() /
-- release_failed_booking(), each of which is SECURITY DEFINER and enforces
-- its own ownership + state-machine checks.

drop policy if exists "bookings update own" on public.bookings;
revoke update on public.bookings from authenticated;

-- Same for slots: availability may only flip via create_booking() / cancel_booking().
revoke update on public.slots from authenticated;
revoke insert, delete on public.slots from authenticated;

-- ============================================================================
-- C4. create_booking — the atomic "reserve slot(s) + insert booking" step
-- ============================================================================
-- Locks every requested slot row (in a stable id order, to avoid deadlocking
-- against another booking attempt that also touches some of these slots),
-- verifies EVERY one is still 'available', then in the same transaction
-- inserts one `bookings` row + flips every slot to 'booked'. Two users
-- clicking "Confirm" on the same slot at the same instant: the second
-- transaction blocks on the row lock until the first commits, then re-reads
-- status='booked' and raises SLOT_UNAVAILABLE — it can never see the
-- pre-lock 'available' value. This is what actually prevents the double
-- booking, not application-level checks.

create or replace function public.create_booking(p_slot_ids uuid[], p_credit_applied integer default 0)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid := auth.uid();
  v_slot          record;
  v_venue_id      uuid;
  v_sport         text;
  v_date          date;
  v_first_start   time;
  v_last_end      time;
  v_base_price    integer := 0;
  v_platform_fee  integer;
  v_gst           integer;
  v_total         integer;
  v_credit        integer;
  v_time_label    text;
  v_found_count   integer;
  v_booking       public.bookings;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_slot_ids is null or array_length(p_slot_ids, 1) is null then
    raise exception 'NO_SLOTS_SELECTED';
  end if;

  -- Row lock, taken in ascending id order across ALL requested slots before
  -- any status is read, so concurrent callers serialize instead of
  -- interleaving reads and writes.
  for v_slot in
    select * from public.slots
    where id = any (p_slot_ids)
    order by id
    for update
  loop
    if v_slot.status <> 'available' then
      raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0001',
        detail = v_slot.id::text;
    end if;

    if v_venue_id is null then
      v_venue_id := v_slot.venue_id;
      v_sport := v_slot.sport;
      v_date := v_slot.date;
      v_first_start := v_slot.start_time;
      v_last_end := v_slot.end_time;
    else
      if v_slot.venue_id <> v_venue_id or v_slot.sport <> v_sport or v_slot.date <> v_date then
        raise exception 'SLOTS_MUST_SHARE_VENUE_SPORT_DATE';
      end if;
      if v_slot.start_time < v_first_start then v_first_start := v_slot.start_time; end if;
      if v_slot.end_time > v_last_end then v_last_end := v_slot.end_time; end if;
    end if;

    v_base_price := v_base_price + coalesce(v_slot.price, 0);
  end loop;

  select count(*) into v_found_count from public.slots where id = any (p_slot_ids);
  if v_found_count <> array_length(p_slot_ids, 1) or v_found_count = 0 then
    raise exception 'SLOT_NOT_FOUND';
  end if;

  -- Server-side price recompute (never trust a client-supplied total).
  v_platform_fee := round(v_base_price * 0.05);
  v_gst := round((v_base_price + v_platform_fee) * 0.18);
  v_total := v_base_price + v_platform_fee + v_gst;
  v_credit := greatest(0, least(coalesce(p_credit_applied, 0), v_total, public.my_wallet_balance()));

  v_time_label := to_char(v_first_start, 'HH12:MI AM') || ' – ' || to_char(v_last_end, 'HH12:MI AM');

  insert into public.bookings (
    user_id, venue_id, slot_id, sport, date, time,
    price_paid, platform_fee, gst, credit_applied, status
  ) values (
    v_user_id, v_venue_id, p_slot_ids[1], v_sport, v_date, v_time_label,
    v_total, v_platform_fee, v_gst, v_credit, 'pending'
  ) returning * into v_booking;

  insert into public.booking_slots (booking_id, slot_id)
  select v_booking.id, s_id from unnest(p_slot_ids) as s_id;

  update public.slots set status = 'booked' where id = any (p_slot_ids);

  if v_credit > 0 then
    insert into public.wallet_transactions (user_id, amount, type, description)
    values (v_user_id, -v_credit, 'redeemed', 'Applied to booking ' || v_booking.id::text);
  end if;

  return v_booking;
end;
$$;

grant execute on function public.create_booking(uuid[], integer) to authenticated;

-- ============================================================================
-- D4. mark_booking_confirmed — ONLY called by an Edge Function after Razorpay
--     signature verification (never from the frontend directly)
-- ============================================================================

create or replace function public.mark_booking_confirmed(p_booking_id uuid, p_payment_id text)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  update public.bookings
  set status = 'confirmed', payment_id = p_payment_id
  where id = p_booking_id and status = 'pending'
  returning * into v_booking;

  if v_booking.id is null then
    -- Either already confirmed (webhook arrived after client-verify already
    -- ran — fine, just no-op) or genuinely missing.
    select * into v_booking from public.bookings where id = p_booking_id;
    if v_booking.id is null then
      raise exception 'BOOKING_NOT_FOUND';
    end if;
    return v_booking;
  end if;

  perform public.maybe_reward_referral(v_booking.user_id);

  return v_booking;
end;
$$;

-- Callable only by the service role (Edge Functions), never by end users —
-- the whole point is that a booking can't be self-confirmed from the client.
revoke all on function public.mark_booking_confirmed(uuid, text) from public, authenticated, anon;
grant execute on function public.mark_booking_confirmed(uuid, text) to service_role;

-- ============================================================================
-- D5. release_failed_booking — payment failed/abandoned: free the slot(s)
-- ============================================================================

create or replace function public.release_failed_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if auth.role() = 'authenticated' and v_booking.user_id <> auth.uid() then
    raise exception 'NOT_YOUR_BOOKING';
  end if;
  if v_booking.status <> 'pending' then
    return v_booking; -- already resolved one way or another — nothing to release
  end if;

  update public.bookings
  set status = 'cancelled', cancellation_reason = 'payment_failed'
  where id = p_booking_id
  returning * into v_booking;

  update public.slots s
  set status = 'available'
  from public.booking_slots bs
  where bs.booking_id = p_booking_id and s.id = bs.slot_id;

  if v_booking.credit_applied > 0 then
    insert into public.wallet_transactions (user_id, amount, type, description)
    values (
      v_booking.user_id, v_booking.credit_applied, 'refund',
      'Credit restored — payment did not complete for booking ' || p_booking_id::text
    );
  end if;

  return v_booking;
end;
$$;

grant execute on function public.release_failed_booking(uuid) to authenticated, service_role;

-- ============================================================================
-- C5. cancel_booking — user-initiated cancellation, respects the UI's
--     existing CANCELLATION_WINDOW_HOURS policy (2 hours before slot start)
-- ============================================================================
-- Cancels + releases the slot(s) unconditionally (a venue slot shouldn't
-- stay locked just because a refund is or isn't owed). Refund ELIGIBILITY is
-- returned to the caller so the cancel-booking Edge Function (Phase D) can
-- decide whether to also call the Razorpay refund API.

create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns table (booking public.bookings, hours_before_slot numeric, refund_eligible boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking     public.bookings;
  v_slot_start  timestamptz;
  v_hours_left  numeric;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if v_booking.user_id <> auth.uid() then
    raise exception 'NOT_YOUR_BOOKING';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'BOOKING_NOT_CANCELLABLE';
  end if;

  select (v_booking.date + s.start_time)::timestamptz into v_slot_start
  from public.slots s where s.id = v_booking.slot_id;

  v_hours_left := extract(epoch from (v_slot_start - now())) / 3600.0;

  update public.bookings
  set status = 'cancelled', cancellation_reason = coalesce(p_reason, 'user_cancelled')
  where id = p_booking_id
  returning * into v_booking;

  update public.slots s
  set status = 'available'
  from public.booking_slots bs
  where bs.booking_id = p_booking_id and s.id = bs.slot_id;

  return query select v_booking, v_hours_left, (v_hours_left > 2 and v_booking.payment_id is not null);
end;
$$;

grant execute on function public.cancel_booking(uuid, text) to authenticated;

-- ============================================================================
-- D6. mark_booking_refunded — Edge Function calls this AFTER a successful
--     Razorpay refund; writes the admin-visible refund_log row
-- ============================================================================

create or replace function public.mark_booking_refunded(
  p_booking_id          uuid,
  p_razorpay_refund_id  text,
  p_razorpay_payment_id text,
  p_amount              integer
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
begin
  update public.bookings
  set status = 'cancelled_refunded'
  where id = p_booking_id and status = 'cancelled'
  returning * into v_booking;

  if v_booking.id is null then
    raise exception 'BOOKING_NOT_CANCELLED';
  end if;

  insert into public.refund_log (
    booking_id, user_id, razorpay_payment_id, razorpay_refund_id, amount, status
  ) values (
    p_booking_id, v_booking.user_id, p_razorpay_payment_id, p_razorpay_refund_id, p_amount, 'processed'
  );

  return v_booking;
end;
$$;

revoke all on function public.mark_booking_refunded(uuid, text, text, integer) from public, authenticated, anon;
grant execute on function public.mark_booking_refunded(uuid, text, text, integer) to service_role;

-- ============================================================================
-- E1. Hosted games — atomic join / leave / cancel
-- ============================================================================

-- Total per-slot cost the host locked in when creating the game (drives
-- `perHead` in the UI for cost_type = 'split') — not in Phase A's schema,
-- added here since Host a Game (Phase 4 UI) already computes and needs to
-- persist it.
alter table public.hosted_games add column if not exists total_cost integer not null default 0;
-- Optional link back to the group a game was hosted for (Group detail page
-- shows "games hosted from this group") — also not in Phase A's schema.
alter table public.hosted_games add column if not exists group_id uuid references public.groups (id) on delete set null;

drop policy if exists "hosted_games update own" on public.hosted_games;
revoke update on public.hosted_games from authenticated;
-- Non-counter fields the host may still edit directly (description/time
-- typo fixes etc.) — spots_filled and status are function-only.
grant update (sport, date, time, skill_level, description, join_policy, total_spots, total_cost)
  on public.hosted_games to authenticated;

create policy "hosted_games update own fields" on public.hosted_games
  for update using (auth.uid() = host_user_id) with check (auth.uid() = host_user_id);

create or replace function public.join_hosted_game(p_game_id uuid)
returns public.hosted_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_game    public.hosted_games;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.hosted_games where id = p_game_id for update;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.status <> 'active' then raise exception 'GAME_NOT_ACTIVE'; end if;

  if v_game.join_policy = 'open' then
    if v_game.spots_filled >= v_game.total_spots then
      raise exception 'GAME_FULL';
    end if;
    insert into public.game_participants (game_id, user_id, status)
    values (p_game_id, v_user_id, 'joined')
    on conflict (game_id, user_id) do nothing;
  else
    insert into public.game_participants (game_id, user_id, status)
    values (p_game_id, v_user_id, 'requested')
    on conflict (game_id, user_id) do nothing;
  end if;

  -- Recompute from source of truth (self-healing under READ COMMITTED: the
  -- row lock above means a concurrent joiner either committed before this
  -- statement's snapshot, or is still waiting on the lock — never both
  -- "in flight" at once).
  update public.hosted_games
  set spots_filled = (
    select count(*) from public.game_participants
    where game_id = p_game_id and status = 'joined'
  )
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

grant execute on function public.join_hosted_game(uuid) to authenticated;

create or replace function public.leave_hosted_game(p_game_id uuid)
returns public.hosted_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_game    public.hosted_games;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  perform 1 from public.hosted_games where id = p_game_id for update;

  delete from public.game_participants where game_id = p_game_id and user_id = v_user_id;

  update public.hosted_games
  set spots_filled = (
    select count(*) from public.game_participants
    where game_id = p_game_id and status = 'joined'
  )
  where id = p_game_id
  returning * into v_game;

  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  return v_game;
end;
$$;

grant execute on function public.leave_hosted_game(uuid) to authenticated;

create or replace function public.cancel_hosted_game(p_game_id uuid)
returns public.hosted_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_game public.hosted_games;
begin
  update public.hosted_games
  set status = 'cancelled'
  where id = p_game_id and host_user_id = auth.uid() and status = 'active'
  returning * into v_game;

  if v_game.id is null then raise exception 'NOT_ALLOWED_OR_NOT_FOUND'; end if;
  return v_game;
end;
$$;

grant execute on function public.cancel_hosted_game(uuid) to authenticated;

-- ============================================================================
-- E2. Groups — atomic join / leave (member_count self-heals the same way)
-- ============================================================================

drop policy if exists "groups update own" on public.groups;
revoke update on public.groups from authenticated;
grant update (name, sport, description, cover_photo_url, privacy, area) on public.groups to authenticated;

create policy "groups update own fields" on public.groups
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

create or replace function public.join_group(p_group_id uuid)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_group   public.groups;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  perform 1 from public.groups where id = p_group_id for update;

  insert into public.group_members (group_id, user_id)
  values (p_group_id, v_user_id)
  on conflict (group_id, user_id) do nothing;

  update public.groups
  set member_count = (select count(*) from public.group_members where group_id = p_group_id)
  where id = p_group_id
  returning * into v_group;

  if v_group.id is null then raise exception 'GROUP_NOT_FOUND'; end if;
  return v_group;
end;
$$;

grant execute on function public.join_group(uuid) to authenticated;

create or replace function public.leave_group(p_group_id uuid)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_group   public.groups;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  perform 1 from public.groups where id = p_group_id for update;

  delete from public.group_members where group_id = p_group_id and user_id = v_user_id;

  update public.groups
  set member_count = (select count(*) from public.group_members where group_id = p_group_id)
  where id = p_group_id
  returning * into v_group;

  if v_group.id is null then raise exception 'GROUP_NOT_FOUND'; end if;
  return v_group;
end;
$$;

grant execute on function public.leave_group(uuid) to authenticated;

-- ============================================================================
-- E3. Event registrations — atomic register / unregister, respects
--     participant_limit under concurrent registration for the last spot
-- ============================================================================

revoke update on public.events from authenticated; -- was already client-unwritable; explicit for clarity

-- Display unit for entry_fee ("per team", "per pair", "free entry"...) —
-- not in Phase A's schema; the Events UI (Phase 4) needs it alongside the
-- numeric fee.
alter table public.events add column if not exists fee_unit text not null default 'entry fee';

create or replace function public.register_for_event(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event   public.events;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_event from public.events where id = p_event_id for update;
  if v_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.participant_count >= v_event.participant_limit then
    raise exception 'EVENT_FULL';
  end if;

  insert into public.event_registrations (event_id, user_id)
  values (p_event_id, v_user_id)
  on conflict (event_id, user_id) do nothing;

  update public.events
  set participant_count = (
    select count(*) from public.event_registrations where event_id = p_event_id
  )
  where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

grant execute on function public.register_for_event(uuid) to authenticated;

create or replace function public.unregister_from_event(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event   public.events;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  perform 1 from public.events where id = p_event_id for update;

  delete from public.event_registrations where event_id = p_event_id and user_id = v_user_id;

  update public.events
  set participant_count = (
    select count(*) from public.event_registrations where event_id = p_event_id
  )
  where id = p_event_id
  returning * into v_event;

  if v_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  return v_event;
end;
$$;

grant execute on function public.unregister_from_event(uuid) to authenticated;

-- ============================================================================
-- F1. Referral codes — real, unique, generated server-side per user
-- ============================================================================

alter table public.users add column if not exists referral_code text unique;

create or replace function public.generate_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text;
  v_exists boolean;
begin
  loop
    v_code := 'JP' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    select exists(select 1 from public.users where referral_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;
  return v_code;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, phone, name, referral_code)
  values (
    new.id,
    coalesce(nullif(new.phone, ''), new.id::text),
    '',
    public.generate_referral_code()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger declaration unchanged (re-declared so this migration stays a
-- complete, standalone unit) — it already points at handle_new_auth_user.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill any users created before this migration.
update public.users set referral_code = public.generate_referral_code() where referral_code is null;

-- ============================================================================
-- F2. Link a referral the moment the referred phone number actually signs up
-- ============================================================================

create or replace function public.link_referral_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.referrals
  set referred_user_id = new.id, status = 'joined'
  where referred_phone = new.phone and status = 'invited' and referred_user_id is null;
  return new;
end;
$$;

drop trigger if exists on_user_signup_link_referral on public.users;
create trigger on_user_signup_link_referral
  after insert on public.users
  for each row execute function public.link_referral_on_signup();

-- create_referral: normalizes the phone the same way the app does (last 10
-- digits) so the trigger above reliably matches at signup time.
create or replace function public.create_referral(p_referred_phone text)
returns public.referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_phone   text;
  v_ref     public.referrals;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  v_phone := right(regexp_replace(p_referred_phone, '\D', '', 'g'), 10);
  if length(v_phone) <> 10 then
    raise exception 'INVALID_PHONE';
  end if;

  insert into public.referrals (referrer_user_id, referred_phone, status)
  values (v_user_id, v_phone, 'invited')
  returning * into v_ref;

  return v_ref;
end;
$$;

grant execute on function public.create_referral(text) to authenticated;

-- ============================================================================
-- F3. Wallet balance — derived from the ledger, never a stored/editable field
-- ============================================================================

create or replace function public.my_wallet_balance()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer
  from public.wallet_transactions
  where user_id = auth.uid();
$$;

grant execute on function public.my_wallet_balance() to authenticated;

-- ============================================================================
-- F4. First-booking referral reward — hooked from mark_booking_confirmed()
-- ============================================================================

create or replace function public.maybe_reward_referral(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral         public.referrals;
  v_confirmed_count  integer;
  v_reward_amount    integer := 100; -- flat ₹100 both sides; tune freely
begin
  -- Only the referred user's FIRST-ever confirmed booking triggers a reward.
  select count(*) into v_confirmed_count
  from public.bookings
  where user_id = p_user_id and status in ('confirmed', 'completed', 'cancelled_refunded');

  if v_confirmed_count <> 1 then
    return;
  end if;

  select * into v_referral from public.referrals
  where referred_user_id = p_user_id and status = 'joined'
  limit 1;

  if v_referral.id is null then
    return; -- this user wasn't referred, or the reward already fired
  end if;

  update public.referrals
  set status = 'first_booking_complete', reward_amount = v_reward_amount
  where id = v_referral.id;

  insert into public.wallet_transactions (user_id, amount, type, description)
  values
    (v_referral.referrer_user_id, v_reward_amount, 'referral_reward',
      'Referral reward — your friend completed their first booking'),
    (p_user_id, v_reward_amount, 'referral_reward',
      'Welcome reward — your first booking');
end;
$$;

revoke all on function public.maybe_reward_referral(uuid) from public, authenticated, anon;
grant execute on function public.maybe_reward_referral(uuid) to service_role;

-- ============================================================================
-- End of Phases C–F
-- ============================================================================