-- ============================================================================
-- Corporate profile — a player's registered business details (GSTIN, company
-- name, address) so venues can issue GST invoices. One profile per player.
-- Safe to re-run.
-- ============================================================================
create table if not exists public.corporate_profiles (
  user_id         uuid primary key references public.users (id) on delete cascade,
  gst_number      text not null,
  company_name    text not null,
  company_address text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint corporate_gst_format
    check (gst_number ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  constraint corporate_name_len    check (char_length(trim(company_name)) between 2 and 120),
  constraint corporate_address_len check (char_length(trim(company_address)) between 5 and 300)
);

alter table public.corporate_profiles enable row level security;

-- Players read only their own profile; writes go through the RPCs below.
drop policy if exists "corporate_profiles select own" on public.corporate_profiles;
create policy "corporate_profiles select own" on public.corporate_profiles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.save_corporate_profile(
  p_gst_number      text,
  p_company_name    text,
  p_company_address text
)
returns public.corporate_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_gst  text := upper(trim(coalesce(p_gst_number, '')));
  v_row  public.corporate_profiles;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_gst !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then raise exception 'INVALID_GST'; end if;
  if char_length(trim(coalesce(p_company_name, ''))) < 2 then raise exception 'NAME_REQUIRED'; end if;
  if char_length(trim(coalesce(p_company_address, ''))) < 5 then raise exception 'ADDRESS_REQUIRED'; end if;

  insert into public.corporate_profiles (user_id, gst_number, company_name, company_address)
  values (v_user, v_gst, left(trim(p_company_name), 120), left(trim(p_company_address), 300))
  on conflict (user_id) do update
    set gst_number = excluded.gst_number,
        company_name = excluded.company_name,
        company_address = excluded.company_address,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.save_corporate_profile(text, text, text) to authenticated;

create or replace function public.delete_corporate_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.corporate_profiles where user_id = auth.uid();
end;
$$;

grant execute on function public.delete_corporate_profile() to authenticated;
