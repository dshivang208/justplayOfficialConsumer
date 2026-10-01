-- ============================================================================
-- JustPlay — stop leaking business-sensitive venue columns to the public
-- ============================================================================
-- "venues public read" is a ROW filter (is_active = true) — Row Level
-- Security in Postgres only ever filters rows, never columns. The schema-
-- level grant `grant select on all tables in schema public to anon,
-- authenticated;` (20260829000000) therefore gave EVERY column of every
-- active venue to anyone holding the public anon key — including the
-- Partner app's later-added legal_business_name, gst_number, pending_name
-- and pending_address (20260829070000). Consumer's own query (`select
-- (PRICING_SELECT)` = "*, venue_pricing(...)") and any direct REST/anon-key
-- call have been returning a venue's GST number and registered legal name
-- to every visitor.
--
-- IMPORTANT — how this is fixed, and why a simpler-looking fix doesn't work:
-- `REVOKE SELECT (col) ON t FROM role` only has an effect on top of an
-- EXISTING column-level grant; it does nothing to narrow an existing
-- TABLE-level grant (confirmed by testing against a real Postgres before
-- writing this). The only way to actually restrict specific columns is the
-- reverse: revoke the table-level SELECT entirely, then grant SELECT on an
-- explicit allow-list of the safe columns. That in turn means a bare
-- `select("*")` from anon/authenticated WILL fail outright once applied
-- (also confirmed by testing) — there is no "partial wildcard" — so
-- Consumer's and Partner's queries are updated in the same change to use
-- an explicit column list instead of `*`.
--
-- This deliberately does NOT touch the four Admin-only columns added by
-- Admin's Phase B (rejection_reason, approved_at, approved_by,
-- deactivation_reason) — Admin's `listVenues()` reads those directly as
-- the same shared `authenticated` role, with no equivalent is_admin()-gated
-- RPC in front of them yet, which is the same class of gap under a
-- different set of columns. Noted for a separate follow-up; fixing it here
-- would risk breaking Admin's venue-approval screen sight unseen.
--
-- Safe to re-run.
-- ============================================================================

revoke select on public.venues from anon, authenticated;

-- Deliberately an ALLOW-list: a column added to `venues` in the future is
-- private by default unless someone consciously adds it here too.
grant select (
  id, name, address, city, latitude, longitude, sports_offered, amenities,
  operating_hours, photos, is_active, tagline, about, area, rating,
  created_at, is_featured, featured_order
) on public.venues to anon, authenticated;

create or replace function public.partner_get_venue_private_details(p_venue_id uuid)
returns table (
  legal_business_name text,
  gst_number text,
  pending_name text,
  pending_address text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.partner_role_for_venue(p_venue_id) is null then
    raise exception 'NOT_ALLOWED';
  end if;

  return query
  select v.legal_business_name, v.gst_number, v.pending_name, v.pending_address
  from public.venues v
  where v.id = p_venue_id;
end;
$$;

grant execute on function public.partner_get_venue_private_details(uuid) to authenticated;