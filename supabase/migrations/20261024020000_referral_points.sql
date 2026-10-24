-- ============================================================================
-- Referral & Points engine
--
-- * Reward wallet becomes a POINTS ledger (wallet_transactions.amount = points).
-- * Admin controls everything from one settings row (referral_settings):
--   program on/off, points for referrer / new user, when the reward fires,
--   point value in ₹, max % of a booking payable with points, caps.
-- * Code-based referrals: a new user enters / opens a friend's code and the
--   server validates it (apply_referral_code). The old phone-invite flow keeps
--   working and now pays out through the same engine.
-- * Points are redeemed inside create_booking (server-side maths, never trusts
--   the client) and flow into the existing payment pipeline via
--   bookings.credit_applied (₹), which create-razorpay-order already subtracts.
-- * Points are restored when a booking is released / cancelled in time.
--
-- Idempotent — safe to re-run. Run AFTER the earlier phase / admin migrations.
-- ============================================================================

-- ── 1. Settings (single row) ────────────────────────────────────────────────
create table if not exists public.referral_settings (
  id                       boolean primary key default true check (id),
  program_enabled          boolean not null default true,   -- referrals + earning points
  redemption_enabled       boolean not null default true,   -- spending points on bookings
  referrer_points          integer not null default 100 check (referrer_points >= 0),
  referee_points           integer not null default 100 check (referee_points >= 0),
  reward_trigger           text    not null default 'first_booking'
                             check (reward_trigger in ('signup', 'first_booking')),
  min_booking_amount       integer not null default 0 check (min_booking_amount >= 0),
  point_value_inr          numeric(8,2) not null default 1 check (point_value_inr > 0),
  max_redeem_percent       integer not null default 50 check (max_redeem_percent between 1 and 100),
  min_redeem_points        integer not null default 0 check (min_redeem_points >= 0),
  max_rewards_per_referrer integer not null default 0 check (max_rewards_per_referrer >= 0), -- 0 = unlimited
  code_window_days         integer not null default 7 check (code_window_days between 0 and 365),
  updated_at               timestamptz not null default now(),
  updated_by               uuid
);

insert into public.referral_settings (id) values (true) on conflict (id) do nothing;

alter table public.referral_settings enable row level security;

drop policy if exists "referral_settings admin read" on public.referral_settings;
create policy "referral_settings admin read" on public.referral_settings
  for select to authenticated using (public.is_admin());
-- No client write policies: changes go through admin_update_referral_settings().

-- ── 2. Ledger / referral / booking columns ──────────────────────────────────
alter table public.wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table public.wallet_transactions add constraint wallet_transactions_type_check
  check (type in ('referral_reward', 'redeemed', 'refund', 'goodwill_credit', 'admin_adjust'));

alter table public.bookings add column if not exists points_redeemed integer not null default 0;

alter table public.referrals add column if not exists referral_code_used   text;
alter table public.referrals add column if not exists reward_points_referee integer not null default 0;
alter table public.referrals add column if not exists rewarded_at          timestamptz;

-- A person can only ever be referred once.
create unique index if not exists uq_referrals_referred_user
  on public.referrals (referred_user_id) where referred_user_id is not null;

-- Direct inserts let a user squat on someone else's referred_user_id; all
-- creation now goes through the SECURITY DEFINER RPCs below.
drop policy if exists "referrals insert own" on public.referrals;

-- A referred user can see the row that links them to their referrer.
drop policy if exists "referrals select as referee" on public.referrals;
create policy "referrals select as referee" on public.referrals
  for select to authenticated using (referred_user_id = auth.uid());

-- ── 3. Public program info (landing page, invite page, booking page) ────────
create or replace function public.get_referral_program()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enabled',             s.program_enabled,
    'redemptionEnabled',   s.redemption_enabled,
    'referrerPoints',      s.referrer_points,
    'refereePoints',       s.referee_points,
    'trigger',             s.reward_trigger,
    'minBookingAmount',    s.min_booking_amount,
    'pointValueInr',       s.point_value_inr,
    'maxRedeemPercent',    s.max_redeem_percent,
    'minRedeemPoints',     s.min_redeem_points
  )
  from public.referral_settings s where s.id;
$$;
grant execute on function public.get_referral_program() to anon, authenticated;

-- ── 4. Reward payout (idempotent, internal) ─────────────────────────────────
create or replace function public._grant_referral_rewards(p_referral_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.referral_settings;
  r          public.referrals;
  v_rewarded integer;
  v_ref_pts  integer;
begin
  select * into s from public.referral_settings where id;
  if not found or not s.program_enabled then return; end if;

  select * into r from public.referrals where id = p_referral_id for update;
  if r.id is null or r.status = 'first_booking_complete' or r.referred_user_id is null then
    return;
  end if;
  if r.referrer_user_id = r.referred_user_id then return; end if;

  v_ref_pts := s.referrer_points;
  if s.max_rewards_per_referrer > 0 then
    select count(*) into v_rewarded from public.referrals
    where referrer_user_id = r.referrer_user_id and status = 'first_booking_complete';
    if v_rewarded >= s.max_rewards_per_referrer then v_ref_pts := 0; end if;
  end if;

  update public.referrals
  set status = 'first_booking_complete',
      reward_amount = v_ref_pts,
      reward_points_referee = s.referee_points,
      rewarded_at = now()
  where id = r.id;

  if v_ref_pts > 0 then
    insert into public.wallet_transactions (user_id, amount, type, description)
    values (r.referrer_user_id, v_ref_pts, 'referral_reward',
            'Referral reward — your friend joined JustPlay');
  end if;
  if s.referee_points > 0 then
    insert into public.wallet_transactions (user_id, amount, type, description)
    values (r.referred_user_id, s.referee_points, 'referral_reward',
            'Welcome reward — you joined with a friend''s code');
  end if;

  begin
    if v_ref_pts > 0 then
      insert into public.user_notifications (user_id, message)
      values (r.referrer_user_id,
              'You earned ' || v_ref_pts || ' points — your friend joined JustPlay!');
    end if;
    if s.referee_points > 0 then
      insert into public.user_notifications (user_id, message)
      values (r.referred_user_id,
              'Welcome! ' || s.referee_points || ' reward points were added to your account.');
    end if;
  exception when others then
    null; -- a notification problem must never block a reward
  end;
end;
$$;
revoke all on function public._grant_referral_rewards(uuid) from public, anon, authenticated;

-- ── 5. Apply a friend's code (new users only) ───────────────────────────────
create or replace function public.apply_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.referral_settings;
  v_uid      uuid := auth.uid();
  v_me       public.users;
  v_referrer public.users;
  v_ref_id   uuid;
  v_code     text := upper(trim(coalesce(p_code, '')));
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into s from public.referral_settings where id;
  if not found or not s.program_enabled then raise exception 'PROGRAM_DISABLED'; end if;
  if v_code = '' then raise exception 'INVALID_CODE'; end if;

  select * into v_me from public.users where id = v_uid;
  if v_me.id is null then raise exception 'AUTH_REQUIRED'; end if;

  if exists (select 1 from public.referrals where referred_user_id = v_uid) then
    raise exception 'ALREADY_REFERRED';
  end if;

  select * into v_referrer from public.users where referral_code = v_code;
  if v_referrer.id is null then raise exception 'INVALID_CODE'; end if;
  if v_referrer.id = v_uid then raise exception 'SELF_REFERRAL'; end if;

  -- Only genuinely new accounts: inside the window and before any booking.
  if v_me.created_at < now() - make_interval(days => s.code_window_days)
     or exists (select 1 from public.bookings
                where user_id = v_uid and status in ('confirmed', 'completed', 'cancelled_refunded')) then
    raise exception 'NOT_ELIGIBLE';
  end if;

  -- If a phone invite already matched this number, reuse that row.
  update public.referrals
  set referred_user_id = v_uid, status = 'joined', referral_code_used = v_code
  where referrer_user_id = v_referrer.id
    and referred_phone = v_me.phone
    and referred_user_id is null
    and status in ('invited', 'joined')
  returning id into v_ref_id;

  if v_ref_id is null then
    insert into public.referrals (referrer_user_id, referred_phone, status, referred_user_id, referral_code_used)
    values (v_referrer.id, v_me.phone, 'joined', v_uid, v_code)
    returning id into v_ref_id;
  end if;

  if s.reward_trigger = 'signup' then
    perform public._grant_referral_rewards(v_ref_id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'trigger', s.reward_trigger,
    'refereePoints', s.referee_points,
    'rewardedNow', s.reward_trigger = 'signup'
  );
end;
$$;
grant execute on function public.apply_referral_code(text) to authenticated;

-- Phone-invite flow: when an invited number signs up, link it (and pay out
-- straight away if the admin chose "on signup").
create or replace function public.link_referral_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_trigger text;
begin
  update public.referrals
  set referred_user_id = new.id, status = 'joined'
  where referred_phone = new.phone and status = 'invited' and referred_user_id is null
    and not exists (select 1 from public.referrals x where x.referred_user_id = new.id)
  returning id into v_id;

  if v_id is not null then
    begin
      select reward_trigger into v_trigger from public.referral_settings where id;
      if v_trigger = 'signup' then
        perform public._grant_referral_rewards(v_id);
      end if;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

-- ── 6. First-booking payout (called from mark_booking_confirmed) ────────────
create or replace function public.maybe_reward_referral(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.referral_settings;
  v_ref      public.referrals;
  v_amount   integer;
begin
  select * into s from public.referral_settings where id;
  if not found or not s.program_enabled or s.reward_trigger <> 'first_booking' then
    return;
  end if;

  select * into v_ref from public.referrals
  where referred_user_id = p_user_id and status = 'joined'
  limit 1;
  if v_ref.id is null then return; end if;

  -- Latest confirmed online booking is the one that just paid.
  select price_paid into v_amount from public.bookings
  where user_id = p_user_id and status in ('confirmed', 'completed')
  order by created_at desc limit 1;
  if coalesce(v_amount, 0) < s.min_booking_amount then return; end if;

  perform public._grant_referral_rewards(v_ref.id);
end;
$$;
revoke all on function public.maybe_reward_referral(uuid) from public, anon, authenticated;
grant execute on function public.maybe_reward_referral(uuid) to service_role;

-- ── 7. create_booking — points redemption (server-side maths) ───────────────
-- p_credit_applied is now "points the player wants to use". Same signature as
-- before, so older clients keep working (they sent their balance 1:1).
create or replace function public.create_booking(
  p_slot_ids uuid[],
  p_credit_applied integer default 0,
  p_walkin_customer_name text default null,
  p_walkin_customer_phone text default null,
  p_walkin_payment_method text default null,
  p_walkin_payment_status text default null,
  p_walkin_amount integer default null,
  p_coupon_code text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_walkin       boolean := p_walkin_customer_name is not null;
  v_user_id         uuid;
  v_slot            record;
  v_venue_id        uuid;
  v_sport           text;
  v_date            date;
  v_court_id        uuid;
  v_court_id_set    boolean := false;
  v_first_start     time;
  v_last_end        time;
  v_base_price      integer := 0;
  v_platform_fee    integer;
  v_gst             integer;
  v_total           integer;
  v_credit          integer := 0;   -- ₹ knocked off by points
  v_points          integer := 0;   -- points spent
  v_time_label      text;
  v_found_count     integer;
  v_booking         public.bookings;
  v_coupon_result   record;
  v_discount_amount integer := 0;
  s                 public.referral_settings;
  v_balance         integer;
  v_cap_inr         integer;
  v_cap_pts         integer;
begin
  if v_is_walkin then
    if p_walkin_customer_phone is null then raise exception 'WALKIN_PHONE_REQUIRED'; end if;
    v_user_id := null;
  else
    v_user_id := auth.uid();
    if v_user_id is null then
      raise exception 'AUTH_REQUIRED' using errcode = '28000';
    end if;
  end if;

  if p_slot_ids is null or array_length(p_slot_ids, 1) is null then
    raise exception 'NO_SLOTS_SELECTED';
  end if;

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
      v_court_id := v_slot.court_id;
      v_court_id_set := true;
      v_first_start := v_slot.start_time;
      v_last_end := v_slot.end_time;
    else
      if v_slot.venue_id <> v_venue_id or v_slot.sport <> v_sport or v_slot.date <> v_date then
        raise exception 'SLOTS_MUST_SHARE_VENUE_SPORT_DATE';
      end if;
      if v_court_id_set and v_slot.court_id is distinct from v_court_id then
        raise exception 'SLOTS_MUST_SHARE_COURT';
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

  if v_is_walkin then
    if public.partner_role_for_venue(v_venue_id) is null then
      raise exception 'NOT_ALLOWED';
    end if;
    v_platform_fee := 0;
    v_gst := 0;
    v_total := coalesce(p_walkin_amount, v_base_price);
  else
    v_platform_fee := round(v_base_price * 0.05);
    v_gst := round((v_base_price + v_platform_fee) * 0.18);
    v_total := v_base_price + v_platform_fee + v_gst;

    if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
      select * into v_coupon_result from public.validate_and_apply_coupon(p_coupon_code, v_venue_id, v_total);
      if not v_coupon_result.valid then
        raise exception '%', v_coupon_result.message using errcode = 'P0001';
      end if;
      v_discount_amount := v_coupon_result.discount_amount;
      v_total := greatest(0, v_total - v_discount_amount);
    end if;

    -- Points redemption, governed entirely by the admin's settings.
    if coalesce(p_credit_applied, 0) > 0 then
      select * into s from public.referral_settings where id;
      if found and s.redemption_enabled then
        -- Serialise this user's redemptions so two concurrent bookings can
        -- never spend the same points twice.
        perform 1 from public.users where id = v_user_id for update;
        v_balance := public.my_wallet_balance();

        v_cap_inr := floor(v_total * s.max_redeem_percent / 100.0)::integer;
        v_cap_pts := floor(v_cap_inr / s.point_value_inr)::integer;
        v_points  := least(p_credit_applied, v_balance, v_cap_pts);

        if v_points > 0 and v_points >= s.min_redeem_points then
          v_credit := least(floor(v_points * s.point_value_inr)::integer, v_total);
          v_points := ceil(v_credit / s.point_value_inr)::integer;
        else
          v_points := 0;
          v_credit := 0;
        end if;
      end if;
    end if;
  end if;

  v_time_label := to_char(v_first_start, 'HH12:MI AM') || ' – ' || to_char(v_last_end, 'HH12:MI AM');

  insert into public.bookings (
    user_id, venue_id, slot_id, sport, date, time,
    price_paid, platform_fee, gst, credit_applied, points_redeemed, status,
    walkin_customer_name, walkin_customer_phone, source, payment_method, payment_status,
    coupon_code, discount_amount
  ) values (
    v_user_id, v_venue_id, p_slot_ids[1], v_sport, v_date, v_time_label,
    v_total, v_platform_fee, v_gst, v_credit, v_points,
    case when v_is_walkin then 'confirmed' else 'pending' end,
    p_walkin_customer_name, p_walkin_customer_phone,
    case when v_is_walkin then 'walk_in' else 'online' end,
    coalesce(p_walkin_payment_method, 'online'),
    case when v_is_walkin then coalesce(p_walkin_payment_status, 'paid') else 'pending' end,
    case when v_discount_amount > 0 then upper(trim(p_coupon_code)) else null end,
    v_discount_amount
  ) returning * into v_booking;

  insert into public.booking_slots (booking_id, slot_id)
  select v_booking.id, s_id from unnest(p_slot_ids) as s_id;

  update public.slots set status = 'booked' where id = any (p_slot_ids);

  if v_points > 0 then
    insert into public.wallet_transactions (user_id, amount, type, description)
    values (v_user_id, -v_points, 'redeemed',
            'Redeemed ' || v_points || ' points on booking ' || v_booking.id::text);
  end if;

  return v_booking;
end;
$$;

-- ── 8. Give points back when a booking is released / cancelled in time ──────
create or replace function public.release_failed_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_pts     integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;
  if auth.role() = 'authenticated' and v_booking.user_id <> auth.uid() then
    raise exception 'NOT_YOUR_BOOKING';
  end if;
  if v_booking.status <> 'pending' then
    return v_booking;
  end if;

  update public.bookings
  set status = 'cancelled', cancellation_reason = 'payment_failed'
  where id = p_booking_id
  returning * into v_booking;

  update public.slots s
  set status = 'available'
  from public.booking_slots bs
  where bs.booking_id = p_booking_id and s.id = bs.slot_id;

  -- Legacy rows (before points) stored the 1:1 credit only in credit_applied.
  v_pts := case when v_booking.points_redeemed > 0 then v_booking.points_redeemed
                else v_booking.credit_applied end;
  if v_pts > 0 and v_booking.user_id is not null then
    insert into public.wallet_transactions (user_id, amount, type, description)
    values (v_booking.user_id, v_pts, 'refund',
            'Points restored — payment did not complete for booking ' || p_booking_id::text);
  end if;

  return v_booking;
end;
$$;

create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns table (booking public.bookings, hours_before_slot numeric, refund_eligible boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking     public.bookings;
  v_prev_status text;
  v_slot_start  timestamptz;
  v_hours_left  numeric;
  v_is_partner  boolean;
  v_is_admin    boolean;
  v_pts         integer;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  v_is_partner := public.partner_role_for_venue(v_booking.venue_id) is not null;
  v_is_admin := public.is_admin();
  if v_booking.user_id is distinct from auth.uid() and not v_is_partner and not v_is_admin then
    raise exception 'NOT_YOUR_BOOKING';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'BOOKING_NOT_CANCELLABLE';
  end if;
  v_prev_status := v_booking.status;

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

  -- Points come back when nothing was paid yet, when the player cancels
  -- inside the refund window, or when the venue / admin cancels.
  v_pts := case when v_booking.points_redeemed > 0 then v_booking.points_redeemed
                else v_booking.credit_applied end;
  if v_pts > 0 and v_booking.user_id is not null
     and (v_prev_status = 'pending'
          or v_hours_left > 2
          or v_booking.user_id is distinct from auth.uid()) then
    insert into public.wallet_transactions (user_id, amount, type, description)
    values (v_booking.user_id, v_pts, 'refund',
            'Points restored — booking ' || p_booking_id::text || ' was cancelled');
  end if;

  return query select v_booking, v_hours_left,
    (v_hours_left > 2 and v_booking.payment_id is not null and v_booking.source = 'online');
end;
$$;

-- ── 9. Player summary ───────────────────────────────────────────────────────
create or replace function public.my_points_summary()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'balance',        coalesce(sum(amount), 0),
    'earned',         coalesce(sum(amount) filter (where amount > 0 and type in ('referral_reward','goodwill_credit','admin_adjust')), 0),
    'redeemed',       coalesce(-sum(amount) filter (where type = 'redeemed'), 0),
    'fromReferrals',  coalesce(sum(amount) filter (where type = 'referral_reward'), 0)
  )
  from public.wallet_transactions where user_id = auth.uid();
$$;
grant execute on function public.my_points_summary() to authenticated;

-- ── 10. Admin RPCs ──────────────────────────────────────────────────────────
create or replace function public.admin_get_referral_settings()
returns public.referral_settings
language plpgsql
stable
security definer
set search_path = public
as $$
declare r public.referral_settings;
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  select * into r from public.referral_settings where id;
  return r;
end;
$$;
grant execute on function public.admin_get_referral_settings() to authenticated;

create or replace function public.admin_update_referral_settings(p jsonb)
returns public.referral_settings
language plpgsql
security definer
set search_path = public
as $$
declare r public.referral_settings;
begin
  if not public.is_super_admin() then raise exception 'NOT_ALLOWED'; end if;
  update public.referral_settings set
    program_enabled          = coalesce((p->>'program_enabled')::boolean, program_enabled),
    redemption_enabled       = coalesce((p->>'redemption_enabled')::boolean, redemption_enabled),
    referrer_points          = coalesce((p->>'referrer_points')::integer, referrer_points),
    referee_points           = coalesce((p->>'referee_points')::integer, referee_points),
    reward_trigger           = coalesce(p->>'reward_trigger', reward_trigger),
    min_booking_amount       = coalesce((p->>'min_booking_amount')::integer, min_booking_amount),
    point_value_inr          = coalesce((p->>'point_value_inr')::numeric, point_value_inr),
    max_redeem_percent       = coalesce((p->>'max_redeem_percent')::integer, max_redeem_percent),
    min_redeem_points        = coalesce((p->>'min_redeem_points')::integer, min_redeem_points),
    max_rewards_per_referrer = coalesce((p->>'max_rewards_per_referrer')::integer, max_rewards_per_referrer),
    code_window_days         = coalesce((p->>'code_window_days')::integer, code_window_days),
    updated_at = now(),
    updated_by = auth.uid()
  where id
  returning * into r;
  return r;
end;
$$;
grant execute on function public.admin_update_referral_settings(jsonb) to authenticated;

create or replace function public.admin_referral_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  select jsonb_build_object(
    'totalReferrals', (select count(*) from public.referrals where referred_user_id is not null),
    'pending',        (select count(*) from public.referrals where status = 'joined'),
    'rewarded',       (select count(*) from public.referrals where status = 'first_booking_complete'),
    'pointsIssued',   (select coalesce(sum(amount), 0) from public.wallet_transactions where amount > 0 and type in ('referral_reward','admin_adjust','goodwill_credit')),
    'pointsRedeemed', (select coalesce(-sum(amount), 0) from public.wallet_transactions where type = 'redeemed'),
    'pointsOutstanding', (select coalesce(sum(amount), 0) from public.wallet_transactions),
    'topReferrers', coalesce((
      select jsonb_agg(t) from (
        select u.name, u.phone, u.referral_code as code,
               count(*) filter (where r.status = 'first_booking_complete') as rewarded,
               count(*) as invited,
               coalesce(sum(r.reward_amount), 0) as points
        from public.referrals r join public.users u on u.id = r.referrer_user_id
        where r.referred_user_id is not null
        group by u.id order by rewarded desc, invited desc limit 5
      ) t), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;
grant execute on function public.admin_referral_overview() to authenticated;

create or replace function public.admin_list_referrals(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  select coalesce(jsonb_agg(t), '[]'::jsonb) into v from (
    select r.id, r.status, r.reward_amount as "referrerPoints", r.reward_points_referee as "refereePoints",
           r.referral_code_used as code, r.created_at as "createdAt", r.rewarded_at as "rewardedAt",
           a.name as "referrerName", a.phone as "referrerPhone",
           b.name as "refereeName", coalesce(b.phone, r.referred_phone) as "refereePhone"
    from public.referrals r
    join public.users a on a.id = r.referrer_user_id
    left join public.users b on b.id = r.referred_user_id
    order by r.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) t;
  return v;
end;
$$;
grant execute on function public.admin_list_referrals(integer) to authenticated;

-- Manual credit / debit (support goodwill, corrections). Never below zero.
create or replace function public.admin_adjust_points(p_phone text, p_points integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    public.users;
  v_last10  text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
  v_balance integer;
begin
  if not public.is_super_admin() then raise exception 'NOT_ALLOWED'; end if;
  if p_points is null or p_points = 0 then raise exception 'INVALID_POINTS'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'REASON_REQUIRED'; end if;

  select * into v_user from public.users
  where right(regexp_replace(phone, '\D', '', 'g'), 10) = v_last10 limit 1;
  if v_user.id is null then raise exception 'USER_NOT_FOUND'; end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.wallet_transactions where user_id = v_user.id;
  if v_balance + p_points < 0 then raise exception 'INSUFFICIENT_POINTS'; end if;

  insert into public.wallet_transactions (user_id, amount, type, description)
  values (v_user.id, p_points, 'admin_adjust', trim(p_reason));

  begin
    insert into public.user_notifications (user_id, message)
    values (v_user.id, case when p_points > 0
      then p_points || ' points were added to your account: ' || trim(p_reason)
      else abs(p_points) || ' points were adjusted on your account: ' || trim(p_reason) end);
  exception when others then null;
  end;

  return jsonb_build_object('name', v_user.name, 'newBalance', v_balance + p_points);
end;
$$;
grant execute on function public.admin_adjust_points(text, integer, text) to authenticated;
