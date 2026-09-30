-- ============================================================================
-- JustPlay Consumer — collect real payment for paid events/tournaments
-- ============================================================================
-- register_for_event inserted a confirmed event_registrations row for ANY
-- event, including ones with entry_fee > 0, with no payment step at all —
-- the confirm screen said "Payment collected at the venue" but nothing
-- tracked who had actually paid. This mirrors the booking flow's Razorpay
-- pipeline (create_booking -> create-razorpay-order -> Checkout ->
-- verify-razorpay-payment -> mark_booking_confirmed) for events:
--   start_event_registration  — reserves a spot as 'pending' (server-priced
--                                from events.entry_fee, never client-trusted)
--   mark_event_registration_confirmed — service-role only, called after a
--                                verified Razorpay payment
--   release_failed_event_registration — frees the spot if checkout is
--                                dismissed or payment fails
-- register_for_event stays as-is for entry_fee = 0 events (free entry /
-- "Register Interest") — those still confirm immediately, no payment step.
--
-- event_registrations previously had no status at all (a row = registered,
-- full stop) and a hard UNIQUE(event_id, user_id), which would have
-- permanently locked a user out after one abandoned payment. Replaced with
-- a partial unique index that only applies to non-cancelled rows, so a
-- failed attempt can always be retried.
--
-- Safe to re-run.
-- ============================================================================

alter table public.event_registrations
  add column if not exists status text not null default 'confirmed',
  add column if not exists amount_paid integer not null default 0,
  add column if not exists razorpay_order_id text,
  add column if not exists payment_id text,
  add column if not exists cancellation_reason text;

alter table public.event_registrations
  drop constraint if exists event_registrations_status_check;
alter table public.event_registrations
  add constraint event_registrations_status_check
  check (status in ('pending', 'confirmed', 'cancelled'));

-- Replace the hard unique constraint with a partial one: at most one
-- pending/confirmed row per (event, user), but any number of cancelled
-- (abandoned-payment) rows, so a retry after a failed payment always works.
alter table public.event_registrations drop constraint if exists event_registrations_unique;
drop index if exists event_registrations_active_unique;
create unique index event_registrations_active_unique
  on public.event_registrations (event_id, user_id)
  where status <> 'cancelled';

-- payment_events (already used for booking payments) doubles as the audit
-- log for event payments too — one more nullable FK, same table.
alter table public.payment_events
  add column if not exists event_registration_id uuid
    references public.event_registrations (id) on delete set null;
create index if not exists idx_payment_events_event_registration_id
  on public.payment_events (event_registration_id);

-- ----------------------------------------------------------------------------
-- register_for_event — unchanged for free events; now explicitly refuses a
-- paid event so nothing can bypass the payment flow below.
-- ----------------------------------------------------------------------------
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
  if v_event.date < current_date then raise exception 'EVENT_ALREADY_HAPPENED'; end if;
  if v_event.entry_fee > 0 then raise exception 'PAYMENT_REQUIRED'; end if;
  if v_event.participant_count >= v_event.participant_limit then
    raise exception 'EVENT_FULL';
  end if;

  insert into public.event_registrations (event_id, user_id, status, amount_paid)
  values (p_event_id, v_user_id, 'confirmed', 0)
  on conflict (event_id, user_id) where status <> 'cancelled' do nothing;

  update public.events
  set participant_count = (
    select count(*) from public.event_registrations
    where event_id = p_event_id and status in ('pending', 'confirmed')
  )
  where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

grant execute on function public.register_for_event(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- start_event_registration — the paid-event equivalent of create_booking:
-- reserves the spot as 'pending' before any payment happens, priced
-- server-side from events.entry_fee.
-- ----------------------------------------------------------------------------
create or replace function public.start_event_registration(p_event_id uuid)
returns public.event_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_event        public.events;
  v_reg          public.event_registrations;
  v_active_count integer;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_event from public.events where id = p_event_id for update;
  if v_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.date < current_date then raise exception 'EVENT_ALREADY_HAPPENED'; end if;
  if v_event.entry_fee <= 0 then raise exception 'EVENT_IS_FREE'; end if;

  select count(*) into v_active_count
  from public.event_registrations
  where event_id = p_event_id and status in ('pending', 'confirmed') and user_id <> v_user_id;

  if v_active_count >= v_event.participant_limit then
    raise exception 'EVENT_FULL';
  end if;

  insert into public.event_registrations (event_id, user_id, status, amount_paid)
  values (p_event_id, v_user_id, 'pending', v_event.entry_fee)
  on conflict (event_id, user_id) where status <> 'cancelled'
  do update set
    amount_paid = excluded.amount_paid,
    razorpay_order_id = null,
    payment_id = null
  where public.event_registrations.status = 'pending'
  returning * into v_reg;

  -- A conflicting row exists but wasn't 'pending' (must be 'confirmed') —
  -- the DO UPDATE's WHERE didn't match, so nothing was written/returned.
  if v_reg.id is null then
    raise exception 'ALREADY_REGISTERED';
  end if;

  update public.events
  set participant_count = (
    select count(*) from public.event_registrations
    where event_id = p_event_id and status in ('pending', 'confirmed')
  )
  where id = p_event_id;

  return v_reg;
end;
$$;

grant execute on function public.start_event_registration(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- mark_event_registration_confirmed — ONLY called by an Edge Function after
-- Razorpay signature verification (never from the frontend directly).
-- ----------------------------------------------------------------------------
create or replace function public.mark_event_registration_confirmed(
  p_registration_id uuid,
  p_payment_id text
)
returns public.event_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.event_registrations;
begin
  update public.event_registrations
  set status = 'confirmed', payment_id = p_payment_id
  where id = p_registration_id and status = 'pending'
  returning * into v_reg;

  if v_reg.id is null then
    -- Already confirmed (webhook arrived after client-verify already ran) or
    -- genuinely missing — either way, no state change needed here.
    select * into v_reg from public.event_registrations where id = p_registration_id;
    if v_reg.id is null then raise exception 'REGISTRATION_NOT_FOUND'; end if;
    return v_reg;
  end if;

  return v_reg;
end;
$$;

revoke all on function public.mark_event_registration_confirmed(uuid, text)
  from public, authenticated, anon;
grant execute on function public.mark_event_registration_confirmed(uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- release_failed_event_registration — payment dismissed/failed: free the
-- reserved spot. Mirrors release_failed_booking.
-- ----------------------------------------------------------------------------
create or replace function public.release_failed_event_registration(p_registration_id uuid)
returns public.event_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg public.event_registrations;
begin
  select * into v_reg from public.event_registrations where id = p_registration_id;
  if v_reg.id is null then raise exception 'REGISTRATION_NOT_FOUND'; end if;
  if auth.role() = 'authenticated' and v_reg.user_id <> auth.uid() then
    raise exception 'NOT_YOUR_REGISTRATION';
  end if;
  if v_reg.status <> 'pending' then
    return v_reg; -- already resolved one way or another — nothing to release
  end if;

  update public.event_registrations
  set status = 'cancelled', cancellation_reason = 'payment_failed'
  where id = p_registration_id
  returning * into v_reg;

  update public.events
  set participant_count = (
    select count(*) from public.event_registrations
    where event_id = v_reg.event_id and status in ('pending', 'confirmed')
  )
  where id = v_reg.event_id;

  return v_reg;
end;
$$;

grant execute on function public.release_failed_event_registration(uuid) to authenticated;

-- unregister_from_event: recompute using the same 'pending'+'confirmed' rule.
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
    select count(*) from public.event_registrations
    where event_id = p_event_id and status in ('pending', 'confirmed')
  )
  where id = p_event_id
  returning * into v_event;

  if v_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  return v_event;
end;
$$;

grant execute on function public.unregister_from_event(uuid) to authenticated;

-- Backfill: recompute every event's participant_count under the new rule
-- (harmless no-op today, since every pre-existing row is 'confirmed').
update public.events e
set participant_count = (
  select count(*) from public.event_registrations r
  where r.event_id = e.id and r.status in ('pending', 'confirmed')
);