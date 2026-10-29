-- ============================================================================
-- JustPlay — two-level QR entry
--   Level 1  QR -> website            (/q)
--   Level 2  QR -> one venue directly (/q/<venue qr_code>)
-- * venues.qr_code : short, stable, unguessable-enough public code per venue
-- * venue_qr_scans : one row per scan (venue_id null = website QR)
-- Safe to re-run. Needs is_admin() and partner_role_for_venue() (admin/partner migrations).
-- ============================================================================

alter table public.venues add column if not exists qr_code text;

create or replace function public._gen_venue_qr_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';   -- no 0/o/1/l/i
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..7 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.venues where qr_code = code);
  end loop;
  return code;
end;
$$;

update public.venues set qr_code = public._gen_venue_qr_code() where qr_code is null;
create unique index if not exists venues_qr_code_key on public.venues (qr_code);

create or replace function public.trg_venue_qr_code()
returns trigger
language plpgsql
as $$
begin
  if new.qr_code is null then new.qr_code := public._gen_venue_qr_code(); end if;
  return new;
end;
$$;
drop trigger if exists trg_venue_qr_code on public.venues;
create trigger trg_venue_qr_code before insert on public.venues
  for each row execute function public.trg_venue_qr_code();

-- Scans ----------------------------------------------------------------------
create table if not exists public.venue_qr_scans (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid references public.venues (id) on delete cascade,   -- null = website QR
  level       smallint not null check (level in (1, 2)),
  scanned_at  timestamptz not null default now()
);
create index if not exists venue_qr_scans_venue_idx on public.venue_qr_scans (venue_id, scanned_at desc);

alter table public.venue_qr_scans enable row level security;
drop policy if exists "qr scans admin read" on public.venue_qr_scans;
create policy "qr scans admin read" on public.venue_qr_scans for select to authenticated using (public.is_admin());
-- no direct writes: scans are recorded only through record_qr_scan()

-- Called by the website when a QR link opens. Returns the venue id to open
-- (level 2) or null (level 1 / unknown / inactive venue -> caller falls back).
create or replace function public.record_qr_scan(p_code text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue uuid;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    insert into public.venue_qr_scans (venue_id, level) values (null, 1);
    return null;
  end if;

  select id into v_venue from public.venues
  where qr_code = lower(trim(p_code)) and is_active = true
  limit 1;

  if v_venue is not null then
    insert into public.venue_qr_scans (venue_id, level) values (v_venue, 2);
  end if;
  return v_venue;
end;
$$;
grant execute on function public.record_qr_scan(text) to anon, authenticated;

-- Partner dashboard: how often has MY venue's QR been scanned?
create or replace function public.partner_venue_qr_stats(p_venue_id uuid)
returns table (total bigint, last_7d bigint, last_30d bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.partner_role_for_venue(p_venue_id) is null then raise exception 'NOT_ALLOWED'; end if;
  return query
  select count(*),
         count(*) filter (where scanned_at > now() - interval '7 days'),
         count(*) filter (where scanned_at > now() - interval '30 days')
  from public.venue_qr_scans where venue_id = p_venue_id;
end;
$$;
grant execute on function public.partner_venue_qr_stats(uuid) to authenticated;

-- Admin: scan totals for the website QR + every venue
create or replace function public.admin_qr_stats()
returns table (venue_id uuid, venue_name text, total bigint, last_30d bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  return query
  select s.venue_id, coalesce(v.name, 'Website QR'), count(*),
         count(*) filter (where s.scanned_at > now() - interval '30 days')
  from public.venue_qr_scans s left join public.venues v on v.id = s.venue_id
  group by s.venue_id, v.name
  order by 3 desc;
end;
$$;
grant execute on function public.admin_qr_stats() to authenticated;
