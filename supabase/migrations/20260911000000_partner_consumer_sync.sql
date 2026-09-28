-- ============================================================================
-- JustPlay — Partner → Consumer sync fixes
-- ============================================================================
-- The Consumer app reads venue-level columns (venues.sports_offered,
-- venues.operating_hours) and slots. The Partner app writes court-level data
-- (courts, slots, venue_pricing). Nothing kept the two in step:
--
--  1. venues.operating_hours was NEVER written by the Partner app (owners
--     set opening hours per court), so Consumer showed "Hours unavailable"
--     or stale seed hours.
--  2. venues.sports_offered only ever gained sports (partner_add_court /
--     partner_update_court union new sports in). Deleting a court, marking
--     it inactive, or changing its sport left the old sport listed on
--     Consumer with no bookable slots behind it.
--  3. Marking a court "inactive" left its future slots 'available', so
--     Consumer users could still book a court the owner had switched off.
--  4. courts_hours_check (closes_at > opens_at) contradicts the overnight
--     support added in 20260829080000 (e.g. 22:00-06:00 or 06:00-06:00) and
--     rejects those courts outright, so overnight venues could never save.
--
-- Safe to re-run.
-- ============================================================================

-- 4. Allow overnight / 24h courts (partner_generate_slots already handles them).
alter table public.courts drop constraint if exists courts_hours_check;

-- ---------------------------------------------------------------------------
-- 1 + 2. Recompute venue-level sports and hours from the venue's courts.
--   sports_offered  = sports of ACTIVE courts, plus any sport that still has
--                     court-less (legacy/seed) future slots so demo data
--                     isn't wiped the moment a first court is added.
--   operating_hours = earliest open / latest close across ACTIVE courts that
--                     have hours. Overnight closes are stored as > 24:00
--                     (e.g. "30:00"), the format Consumer already parses.
-- A venue with no courts at all is left exactly as it is.
-- ---------------------------------------------------------------------------
create or replace function public.sync_venue_from_courts(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open_mins  integer;
  v_close_mins integer;
begin
  if not exists (select 1 from public.courts where venue_id = p_venue_id) then
    return;
  end if;

  update public.venues
  set sports_offered = (
    select coalesce(jsonb_agg(x.sport order by x.sport), '[]'::jsonb)
    from (
      select c.sport
      from public.courts c
      where c.venue_id = p_venue_id and c.status = 'active'
      union
      select s.sport
      from public.slots s
      where s.venue_id = p_venue_id and s.court_id is null and s.date >= current_date
    ) x
  )
  where id = p_venue_id;

  select
    min((extract(epoch from c.opens_at) / 60)::integer),
    max(
      (extract(epoch from c.closes_at) / 60)::integer
        + case when c.closes_at <= c.opens_at then 1440 else 0 end
    )
  into v_open_mins, v_close_mins
  from public.courts c
  where c.venue_id = p_venue_id
    and c.status = 'active'
    and c.opens_at is not null
    and c.closes_at is not null;

  if v_open_mins is not null then
    update public.venues
    set operating_hours = jsonb_build_object(
      'open',  lpad((v_open_mins / 60)::text, 2, '0')  || ':' || lpad((v_open_mins % 60)::text, 2, '0'),
      'close', lpad((v_close_mins / 60)::text, 2, '0') || ':' || lpad((v_close_mins % 60)::text, 2, '0')
    )
    where id = p_venue_id;
  end if;
end;
$$;

revoke all on function public.sync_venue_from_courts(uuid) from public, anon, authenticated;

create or replace function public.trg_courts_sync_venue()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_venue_from_courts(old.venue_id);
  else
    perform public.sync_venue_from_courts(new.venue_id);
  end if;
  return null;
end;
$$;

drop trigger if exists courts_sync_venue on public.courts;
create trigger courts_sync_venue
  after insert or update or delete on public.courts
  for each row execute function public.trg_courts_sync_venue();

-- ---------------------------------------------------------------------------
-- 3. Inactive court => its future open slots stop being bookable.
--    Reuses the existing 'blocked' status (same approach as venue
--    exceptions) with a fixed reason, so re-activating restores exactly
--    the slots this trigger blocked and never touches owner-blocked ones.
-- ---------------------------------------------------------------------------
create or replace function public.trg_courts_status_slots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'inactive' then
    update public.slots
    set status = 'blocked', blocked_reason = 'Court inactive', blocked_at = now()
    where court_id = new.id and status = 'available' and date >= current_date;
  elsif new.status = 'active' then
    update public.slots
    set status = 'available', blocked_reason = null, blocked_at = null
    where court_id = new.id and status = 'blocked' and blocked_reason = 'Court inactive';
  end if;
  return null;
end;
$$;

drop trigger if exists courts_status_slots on public.courts;
create trigger courts_status_slots
  after update of status on public.courts
  for each row
  when (old.status is distinct from new.status)
  execute function public.trg_courts_status_slots();

-- ---------------------------------------------------------------------------
-- Backfill: bring every venue that already has courts in line right now.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select distinct venue_id from public.courts loop
    perform public.sync_venue_from_courts(r.venue_id);
  end loop;

  update public.slots s
  set status = 'blocked', blocked_reason = 'Court inactive', blocked_at = now()
  from public.courts c
  where s.court_id = c.id and c.status = 'inactive'
    and s.status = 'available' and s.date >= current_date;
end;
$$;