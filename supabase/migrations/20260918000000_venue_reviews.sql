-- ============================================================================
-- JustPlay Consumer — real venue reviews
-- ============================================================================
-- There was no reviews system at all: data/venues.ts hardcoded `reviews: []`
-- and `reviewCount: 0` for every venue, and `venues.rating` was a static
-- column that defaulted every venue to a fake 4.5 with nothing computing
-- it from anything real. This builds the actual thing:
--   - a reviews table, one review per (venue, user), editable by its author
--   - only a user with a COMPLETED booking at that venue may write one —
--     the standard anti-fake-review safeguard any real review product
--     needs, using the booking-completion flow that already exists
--     (partner_mark_booking_completed)
--   - venues.rating / venues.review_count recomputed automatically by a
--     trigger whenever a review is added, changed, or removed — never
--     hand-maintained, never stale
-- Safe to re-run.
-- ============================================================================

-- `users` RLS only lets someone read their OWN row ("users select own"),
-- so a plain PostgREST embed from reviews to users(name) would come back
-- empty for every review except the viewer's own — reviews would show
-- every OTHER author as blank. author_name is a snapshot of the reviewer's
-- display name at the time they wrote (or last edited) their review,
-- written by submit_review below (SECURITY DEFINER, so it can read
-- `users` regardless of that RLS rule). This also means someone's past
-- reviews keep showing the name they had when they posted even if they
-- later rename their account — a reasonable, common choice for reviews.
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  author_name text not null,
  rating      smallint not null,
  body        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_body_length check (body is null or char_length(body) <= 1000),
  constraint reviews_one_per_user_per_venue unique (venue_id, user_id)
);

create index if not exists idx_reviews_venue_id on public.reviews (venue_id, created_at desc);

alter table public.venues add column if not exists review_count integer not null default 0;

alter table public.reviews enable row level security;

-- An RLS policy only FILTERS rows for a role that already has base table
-- privilege — it grants nothing by itself. Explicit, rather than relying
-- on this project's ALTER DEFAULT PRIVILEGES covering a table created by
-- a later migration (confirmed by testing: it doesn't reliably).
grant select on public.reviews to anon, authenticated;

-- Reviews are as public as the venue itself (same visibility rule venues
-- uses), and only ever written through submit_review below — no direct
-- INSERT/UPDATE policy, so a client can never post as another user or
-- skip the completed-booking check.
drop policy if exists "reviews public read" on public.reviews;
create policy "reviews public read" on public.reviews
  for select using (
    exists (select 1 from public.venues v where v.id = reviews.venue_id and v.is_active = true)
  );

-- ----------------------------------------------------------------------------
-- Keep venues.rating / venues.review_count in exact sync with reviews,
-- automatically. NULL rating (not 0, and not a fake default) means "no
-- reviews yet" — the UI is responsible for showing that honestly rather
-- than a fabricated number.
-- ----------------------------------------------------------------------------
create or replace function public.trg_reviews_sync_venue_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue_id uuid := coalesce(new.venue_id, old.venue_id);
  v_avg      numeric;
  v_count    integer;
begin
  select round(avg(rating)::numeric, 1), count(*) into v_avg, v_count
  from public.reviews
  where venue_id = v_venue_id;

  update public.venues
  set rating = v_avg, review_count = coalesce(v_count, 0)
  where id = v_venue_id;

  return null;
end;
$$;

drop trigger if exists reviews_sync_venue_rating on public.reviews;
create trigger reviews_sync_venue_rating
  after insert or update or delete on public.reviews
  for each row
  execute function public.trg_reviews_sync_venue_rating();

-- Existing venues all currently show the old fake static 4.5 default with
-- zero real reviews behind it — recompute for real right now (every venue
-- with no reviews correctly becomes NULL / 0, not 4.5).
update public.venues v
set rating = sub.avg_rating, review_count = sub.cnt
from (
  select venue_id, round(avg(rating)::numeric, 1) as avg_rating, count(*) as cnt
  from public.reviews
  group by venue_id
) sub
where v.id = sub.venue_id;
update public.venues
set rating = null, review_count = 0
where id not in (select distinct venue_id from public.reviews);

-- venues.rating / review_count are now real computed values, not fake
-- business data — safe to add to the public column allow-list.
grant select (rating, review_count) on public.venues to anon, authenticated;

-- ----------------------------------------------------------------------------
-- submit_review — insert-or-update the caller's own review for a venue.
-- Requires at least one of the caller's OWN bookings at that venue to be
-- 'completed' — the only real signal in this schema that they actually
-- showed up, so this is the anti-fake-review gate.
-- ----------------------------------------------------------------------------
create or replace function public.submit_review(p_venue_id uuid, p_rating integer, p_body text)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name    text;
  v_body    text := nullif(btrim(coalesce(p_body, '')), '');
  v_review  public.reviews;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
  if v_body is not null and char_length(v_body) > 1000 then raise exception 'REVIEW_TOO_LONG'; end if;

  if not exists (
    select 1 from public.bookings
    where user_id = v_user_id and venue_id = p_venue_id and status = 'completed'
  ) then
    raise exception 'NOT_ELIGIBLE';
  end if;

  select nullif(btrim(name), '') into v_name from public.users where id = v_user_id;
  v_name := coalesce(v_name, 'JustPlay user');

  insert into public.reviews (venue_id, user_id, author_name, rating, body)
  values (p_venue_id, v_user_id, v_name, p_rating, v_body)
  on conflict (venue_id, user_id)
  do update set rating = excluded.rating, body = excluded.body, author_name = excluded.author_name, updated_at = now()
  returning * into v_review;

  return v_review;
end;
$$;

grant execute on function public.submit_review(uuid, integer, text) to authenticated;

create or replace function public.delete_review(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.reviews where venue_id = p_venue_id and user_id = auth.uid();
end;
$$;

grant execute on function public.delete_review(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- my_review_status — what the venue page needs to decide what to show:
-- can this signed-in user write a review (have they completed a booking
-- here), and do they already have one (so the UI offers "edit" instead of
-- "write"). Two cheap EXISTS checks, no heavy join.
-- ----------------------------------------------------------------------------
create or replace function public.my_review_status(p_venue_id uuid)
returns table (can_review boolean, existing_rating integer, existing_body text)
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.bookings
      where user_id = auth.uid() and venue_id = p_venue_id and status = 'completed'
    ) as can_review,
    r.rating as existing_rating,
    r.body as existing_body
  from (select 1) dummy
  left join public.reviews r on r.venue_id = p_venue_id and r.user_id = auth.uid();
$$;

grant execute on function public.my_review_status(uuid) to authenticated;