-- ============================================================================
-- GST invoice details on bookings — a player can attach their Corporate
-- Profile (GSTIN, company, address) to a booking; the venue then sees it on
-- that booking and issues the GST invoice. Run after 20261023060000_corporate_profile.sql.
-- The details are COPIED onto the booking, so editing the profile later never
-- changes an invoice that was already requested. Safe to re-run.
-- ============================================================================
create table if not exists public.booking_invoice_details (
  booking_id      uuid primary key references public.bookings (id) on delete cascade,
  user_id         uuid not null references public.users (id) on delete cascade,
  gst_number      text not null,
  company_name    text not null,
  company_address text not null,
  created_at      timestamptz not null default now()
);

alter table public.booking_invoice_details enable row level security;

-- The player, the partners of that booking's venue, and admins can read it.
drop policy if exists "booking_invoice select" on public.booking_invoice_details;
create policy "booking_invoice select" on public.booking_invoice_details
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and public.partner_role_for_venue(b.venue_id) is not null
    )
  );

create or replace function public.attach_booking_invoice(p_booking_id uuid)
returns public.booking_invoice_details
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_booking public.bookings;
  v_profile public.corporate_profiles;
  v_row     public.booking_invoice_details;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_booking from public.bookings where id = p_booking_id and user_id = v_user;
  if v_booking.id is null then raise exception 'BOOKING_NOT_FOUND'; end if;
  if v_booking.status like 'cancelled%' then raise exception 'BOOKING_CANCELLED'; end if;

  select * into v_profile from public.corporate_profiles where user_id = v_user;
  if v_profile.user_id is null then raise exception 'NO_CORPORATE_PROFILE'; end if;

  insert into public.booking_invoice_details (booking_id, user_id, gst_number, company_name, company_address)
  values (p_booking_id, v_user, v_profile.gst_number, v_profile.company_name, v_profile.company_address)
  on conflict (booking_id) do update
    set gst_number = excluded.gst_number,
        company_name = excluded.company_name,
        company_address = excluded.company_address
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.attach_booking_invoice(uuid) to authenticated;

create or replace function public.remove_booking_invoice(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.booking_invoice_details where booking_id = p_booking_id and user_id = auth.uid();
end;
$$;

grant execute on function public.remove_booking_invoice(uuid) to authenticated;
