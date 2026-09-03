-- ============================================================================
-- JustPlay — Backend Phase A: Database Schema
-- ============================================================================
-- Run this in the Supabase SQL Editor (or via `supabase db push` / migrations)
-- on a fresh project. Safe to re-run: every statement is idempotent.
--
-- Column legend used in comments below:
--   [SPEC]  — column requested explicitly in the brief
--   [ADD]   — column added beyond the brief because the existing JustPlay
--             UI (Phases 1-5) already depends on this data shape. Each is
--             called out so you can drop it if you don't want it.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. USERS
-- ============================================================================
-- One row per authenticated person. `id` is the SAME id as auth.users(id) —
-- Supabase Auth owns credentials (phone + OTP), this table owns app profile
-- data. A trigger below auto-creates the row the moment someone signs up.

create table if not exists public.users (
  id                 uuid primary key references auth.users (id) on delete cascade,
  phone              text unique not null,                          -- [SPEC]
  name               text not null default '',                      -- [SPEC]
  email              text,                                           -- [SPEC]
  profile_photo_url  text,                                           -- [SPEC]
  created_at         timestamptz not null default now()              -- [SPEC]
);

comment on table public.users is
  'App profile for each authenticated user. 1:1 with auth.users.';

-- ============================================================================
-- 2. VENUES
-- ============================================================================

create table if not exists public.venues (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,                                   -- [SPEC]
  address           text not null,                                   -- [SPEC]
  city              text not null default 'Kanpur',                  -- [SPEC]
  latitude          numeric(9, 6),                                   -- [SPEC]
  longitude         numeric(9, 6),                                   -- [SPEC]
  sports_offered    jsonb not null default '[]'::jsonb,               -- [SPEC] e.g. ["Box Cricket","Football"]
  amenities         jsonb not null default '[]'::jsonb,               -- [SPEC] e.g. ["Parking","Floodlights"]
  operating_hours   jsonb not null default '{}'::jsonb,               -- [SPEC] e.g. {"open":"06:00","close":"23:00"}
  photos            text[] not null default '{}',                    -- [SPEC]
  is_active         boolean not null default true,                   -- [SPEC]
  -- [ADD] the existing venue-detail page (Phase 2) also shows these; keeping
  -- them here avoids a second table for a 1:1 relationship.
  tagline           text,                                             -- [ADD]
  about             text,                                             -- [ADD]
  area              text,                                             -- [ADD] neighbourhood, e.g. "Kakadeo"
  rating            numeric(2, 1) default 4.5,                        -- [ADD]
  created_at        timestamptz not null default now()
);

-- ============================================================================
-- 3. VENUE PRICING
-- ============================================================================

create table if not exists public.venue_pricing (
  id                     uuid primary key default gen_random_uuid(),
  venue_id               uuid not null references public.venues (id) on delete cascade, -- [SPEC]
  sport                  text not null,                               -- [SPEC]
  price_per_slot         integer not null,                            -- [SPEC] whole rupees
  slot_duration_minutes  integer not null default 60,                 -- [SPEC]
  created_at             timestamptz not null default now(),

  constraint venue_pricing_price_nonneg check (price_per_slot >= 0)
);

-- ============================================================================
-- 4. SLOTS
-- ============================================================================

create table if not exists public.slots (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade, -- [SPEC]
  sport       text not null,                                          -- [SPEC]
  date        date not null,                                          -- [SPEC]
  start_time  time not null,                                          -- [SPEC]
  end_time    time not null,                                          -- [SPEC]
  status      text not null default 'available',                     -- [SPEC]
  price       integer,                                                -- [ADD] price snapshot for this slot
  created_at  timestamptz not null default now(),

  constraint slots_status_check check (status in ('available', 'booked', 'blocked')),
  constraint slots_time_order_check check (end_time > start_time),

  -- CRITICAL — prevents the same venue/sport/date/hour being sold twice,
  -- enforced at the database level regardless of what the app does.
  constraint slots_no_double_booking unique (venue_id, sport, date, start_time)
);

-- ============================================================================
-- 5. BOOKINGS
-- ============================================================================

create table if not exists public.bookings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users (id) on delete cascade,   -- [SPEC]
  venue_id              uuid not null references public.venues (id) on delete restrict, -- [SPEC]
  slot_id               uuid not null references public.slots (id) on delete restrict,  -- [SPEC]
  sport                 text not null,                                -- [SPEC]
  date                  date not null,                                -- [SPEC]
  time                  text not null,                                -- [SPEC] display label, e.g. "6:00 PM – 7:00 PM"
  price_paid            integer not null,                             -- [SPEC]
  platform_fee          integer not null default 0,                   -- [SPEC]
  status                text not null default 'pending',              -- [SPEC]
  payment_id            text,                                         -- [SPEC] Razorpay payment/order id (Phase D)
  cancellation_reason   text,                                         -- [SPEC]
  -- [ADD] mirrors the price breakdown already shown in the Phase 2 UI
  gst                   integer not null default 0,                   -- [ADD]
  credit_applied        integer not null default 0,                   -- [ADD] reward-wallet credit used (Phase F)
  created_at            timestamptz not null default now(),

  constraint bookings_status_check
    check (status in ('pending', 'confirmed', 'cancelled', 'completed'))
);

-- ============================================================================
-- 6. HOSTED GAMES
-- ============================================================================

create table if not exists public.hosted_games (
  id             uuid primary key default gen_random_uuid(),
  host_user_id   uuid not null references public.users (id) on delete cascade,   -- [SPEC]
  venue_id       uuid not null references public.venues (id) on delete restrict, -- [SPEC]
  sport          text not null,                                        -- [SPEC]
  date           date not null,                                        -- [SPEC]
  time           text not null,                                        -- [SPEC]
  total_spots    integer not null,                                     -- [SPEC]
  spots_filled   integer not null default 1,                           -- [SPEC] host counts as the first player
  skill_level    text not null default 'Any',                          -- [SPEC]
  cost_type      text not null default 'free',                         -- [SPEC]
  description    text,                                                 -- [SPEC]
  status         text not null default 'active',                       -- [SPEC]
  -- [ADD] the existing Host-a-Game flow (Phase 4) needs this to decide
  -- between an instant "Join" button and a "Request to Join" one.
  join_policy    text not null default 'open',                         -- [ADD]
  created_at     timestamptz not null default now(),

  constraint hosted_games_skill_check
    check (skill_level in ('Beginner', 'Intermediate', 'Advanced', 'Any')),
  constraint hosted_games_cost_check check (cost_type in ('free', 'split')),
  constraint hosted_games_status_check check (status in ('active', 'cancelled', 'completed')),
  constraint hosted_games_join_policy_check check (join_policy in ('open', 'approval')),
  constraint hosted_games_spots_check check (spots_filled >= 0 and spots_filled <= total_spots)
);

-- ============================================================================
-- 7. GAME PARTICIPANTS
-- ============================================================================

create table if not exists public.game_participants (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.hosted_games (id) on delete cascade, -- [SPEC]
  user_id    uuid not null references public.users (id) on delete cascade,        -- [SPEC]
  joined_at  timestamptz not null default now(),                       -- [SPEC]
  status     text not null default 'joined',                           -- [SPEC]

  constraint game_participants_status_check check (status in ('joined', 'requested')),
  constraint game_participants_unique unique (game_id, user_id)
);

-- ============================================================================
-- 8. GROUPS
-- ============================================================================

create table if not exists public.groups (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                                       -- [SPEC]
  sport           text not null,                                       -- [SPEC]
  description     text,                                                -- [SPEC]
  cover_photo_url text,                                                -- [SPEC]
  privacy         text not null default 'public',                      -- [SPEC]
  created_by      uuid not null references public.users (id) on delete cascade, -- [SPEC]
  member_count    integer not null default 1,                          -- [SPEC]
  area            text,                                                -- [ADD] shown on the group card/detail page
  created_at      timestamptz not null default now(),

  constraint groups_privacy_check check (privacy in ('public', 'private'))
);

-- ============================================================================
-- 9. GROUP MEMBERS
-- ============================================================================

create table if not exists public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade, -- [SPEC]
  user_id    uuid not null references public.users (id) on delete cascade,  -- [SPEC]
  joined_at  timestamptz not null default now(),                       -- [SPEC]
  role       text not null default 'member',                           -- [SPEC]

  constraint group_members_role_check check (role in ('member', 'admin')),
  constraint group_members_unique unique (group_id, user_id)
);

-- ============================================================================
-- 10. EVENTS
-- ============================================================================

create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,                                   -- [SPEC]
  description         text,                                            -- [SPEC]
  date                date not null,                                   -- [SPEC]
  venue_id            uuid references public.venues (id) on delete set null, -- [SPEC]
  sport               text not null,                                   -- [SPEC]
  entry_fee           integer not null default 0,                      -- [SPEC]
  participant_limit   integer not null,                                -- [SPEC]
  participant_count   integer not null default 0,                      -- [SPEC]
  organizer_info      jsonb not null default '{}'::jsonb,               -- [SPEC] {"name":"...","about":"..."}
  -- [ADD] used to render the existing Events discovery page (Phase 4)
  kind                text not null default 'Tournament',              -- [ADD]
  time_label          text,                                            -- [ADD] e.g. "9:00 AM onwards"
  cta_type            text not null default 'register',                -- [ADD]
  image_url           text,                                            -- [ADD]
  created_at          timestamptz not null default now(),

  constraint events_kind_check check (kind in ('Tournament', 'Coaching Camp', 'Meetup')),
  constraint events_cta_check check (cta_type in ('register', 'interest')),
  constraint events_participant_check check (participant_count >= 0 and participant_count <= participant_limit)
);

-- ============================================================================
-- 11. EVENT REGISTRATIONS
-- ============================================================================

create table if not exists public.event_registrations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade, -- [SPEC]
  user_id        uuid not null references public.users (id) on delete cascade,  -- [SPEC]
  registered_at  timestamptz not null default now(),                   -- [SPEC]

  constraint event_registrations_unique unique (event_id, user_id)
);

-- ============================================================================
-- 12. WALLET TRANSACTIONS
-- ============================================================================

create table if not exists public.wallet_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade, -- [SPEC]
  amount       integer not null,                                       -- [SPEC] positive = credit, negative = debit
  type         text not null,                                          -- [SPEC]
  description  text,                                                   -- [SPEC]
  created_at   timestamptz not null default now(),                     -- [SPEC]

  constraint wallet_transactions_type_check
    check (type in ('referral_reward', 'redeemed', 'refund'))
);

-- ============================================================================
-- 13. REFERRALS
-- ============================================================================

create table if not exists public.referrals (
  id                 uuid primary key default gen_random_uuid(),
  referrer_user_id   uuid not null references public.users (id) on delete cascade, -- [SPEC]
  referred_phone     text not null,                                    -- [SPEC]
  status             text not null default 'invited',                  -- [SPEC]
  reward_amount      integer not null default 0,                       -- [SPEC]
  created_at         timestamptz not null default now(),               -- [SPEC]
  -- [ADD] filled in once the referred phone number actually signs up,
  -- so we can trace the reward back to a real account.
  referred_user_id   uuid references public.users (id) on delete set null, -- [ADD]

  constraint referrals_status_check
    check (status in ('invited', 'joined', 'first_booking_complete'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Foreign keys
create index if not exists idx_venue_pricing_venue_id on public.venue_pricing (venue_id);
create index if not exists idx_slots_venue_id on public.slots (venue_id);
create index if not exists idx_bookings_user_id on public.bookings (user_id);
create index if not exists idx_bookings_venue_id on public.bookings (venue_id);
create index if not exists idx_bookings_slot_id on public.bookings (slot_id);
create index if not exists idx_hosted_games_venue_id on public.hosted_games (venue_id);
create index if not exists idx_hosted_games_host_user_id on public.hosted_games (host_user_id);
create index if not exists idx_game_participants_game_id on public.game_participants (game_id);
create index if not exists idx_game_participants_user_id on public.game_participants (user_id);
create index if not exists idx_groups_created_by on public.groups (created_by);
create index if not exists idx_group_members_group_id on public.group_members (group_id);
create index if not exists idx_group_members_user_id on public.group_members (user_id);
create index if not exists idx_events_venue_id on public.events (venue_id);
create index if not exists idx_event_registrations_event_id on public.event_registrations (event_id);
create index if not exists idx_event_registrations_user_id on public.event_registrations (user_id);
create index if not exists idx_wallet_transactions_user_id on public.wallet_transactions (user_id);
create index if not exists idx_referrals_referrer_user_id on public.referrals (referrer_user_id);

-- Date/time columns used in queries
create index if not exists idx_slots_date on public.slots (date);
create index if not exists idx_slots_venue_date on public.slots (venue_id, date);
create index if not exists idx_bookings_date on public.bookings (date);
create index if not exists idx_hosted_games_date on public.hosted_games (date);
create index if not exists idx_events_date on public.events (date);

-- Status columns used in filters
create index if not exists idx_slots_status on public.slots (status);
create index if not exists idx_bookings_status on public.bookings (status);
create index if not exists idx_hosted_games_status on public.hosted_games (status);
create index if not exists idx_game_participants_status on public.game_participants (status);
create index if not exists idx_referrals_status on public.referrals (status);

-- ============================================================================
-- AUTO-PROVISION public.users ON SIGNUP
-- ============================================================================
-- When Supabase Auth creates a row in auth.users (after phone OTP verify in
-- Phase B), mirror it into public.users so the rest of the schema has
-- something to reference immediately.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, phone, name)
  values (new.id, coalesce(new.phone, ''), '')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- PUBLIC PROFILE VIEW
-- ============================================================================
-- `users` (below) is locked down to "read/write your own row only", but the
-- app needs to show OTHER people's names/photos: hosted-game host, joined
-- players, group members. This view exposes only the safe subset of columns
-- and is owned by the table owner, so it bypasses the underlying RLS —
-- phone/email never leak through it.

create or replace view public.public_profiles as
select id, name, profile_photo_url
from public.users;

grant select on public.public_profiles to anon, authenticated;

-- ============================================================================
-- SCHEMA-LEVEL GRANTS
-- ============================================================================
-- On Supabase's hosted platform these are already configured by default for
-- every project; they're declared explicitly here so this migration is
-- self-contained and reproducible on any plain Postgres instance too.
-- These GRANTs only say "this role may attempt the operation" — the RLS
-- policies above are what actually decide which rows are visible/writable.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.users force row level security;
alter table public.users enable row level security;

alter table public.venues enable row level security;
alter table public.venue_pricing enable row level security;
alter table public.slots enable row level security;
alter table public.bookings enable row level security;
alter table public.hosted_games enable row level security;
alter table public.game_participants enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.referrals enable row level security;

-- --- users: strictly own-row only -------------------------------------------
drop policy if exists "users select own" on public.users;
create policy "users select own" on public.users
  for select using (auth.uid() = id);

drop policy if exists "users update own" on public.users;
create policy "users update own" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- No insert policy: rows are created only by the handle_new_auth_user
-- trigger (runs as security definer), never directly by a client.
-- No delete policy: profiles are never deleted by clients.

-- --- venues / venue_pricing / slots: public read, writes locked to backend --
-- (No insert/update/delete policy is added for anon/authenticated on any of
-- these three tables. Only requests using the Supabase *service role* key
-- bypass RLS entirely — that's the "backend/admin" write path referenced in
-- the brief, until a dedicated admin panel exists.)
drop policy if exists "venues public read" on public.venues;
create policy "venues public read" on public.venues
  for select using (is_active = true);

drop policy if exists "venue_pricing public read" on public.venue_pricing;
create policy "venue_pricing public read" on public.venue_pricing
  for select using (true);

drop policy if exists "slots public read" on public.slots;
create policy "slots public read" on public.slots
  for select using (true);

-- --- bookings: users see and manage only their own ---------------------------
drop policy if exists "bookings select own" on public.bookings;
create policy "bookings select own" on public.bookings
  for select using (auth.uid() = user_id);

drop policy if exists "bookings insert own" on public.bookings;
create policy "bookings insert own" on public.bookings
  for insert with check (auth.uid() = user_id);

drop policy if exists "bookings update own" on public.bookings;
create policy "bookings update own" on public.bookings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- (Phase C will tighten this to only allow status -> 'cancelled' via a
-- Postgres function, so a client can't rewrite price_paid after the fact.)

-- --- hosted_games: publicly browsable, host manages their own ---------------
drop policy if exists "hosted_games public read" on public.hosted_games;
create policy "hosted_games public read" on public.hosted_games
  for select using (true);

drop policy if exists "hosted_games insert own" on public.hosted_games;
create policy "hosted_games insert own" on public.hosted_games
  for insert with check (auth.uid() = host_user_id);

drop policy if exists "hosted_games update own" on public.hosted_games;
create policy "hosted_games update own" on public.hosted_games
  for update using (auth.uid() = host_user_id) with check (auth.uid() = host_user_id);

-- --- game_participants: publicly readable (roster), self-managed -----------
drop policy if exists "game_participants public read" on public.game_participants;
create policy "game_participants public read" on public.game_participants
  for select using (true);

drop policy if exists "game_participants insert self" on public.game_participants;
create policy "game_participants insert self" on public.game_participants
  for insert with check (auth.uid() = user_id);

drop policy if exists "game_participants delete self" on public.game_participants;
create policy "game_participants delete self" on public.game_participants
  for delete using (auth.uid() = user_id);

-- --- groups: publicly browsable, creator manages ----------------------------
drop policy if exists "groups public read" on public.groups;
create policy "groups public read" on public.groups
  for select using (true);

drop policy if exists "groups insert own" on public.groups;
create policy "groups insert own" on public.groups
  for insert with check (auth.uid() = created_by);

drop policy if exists "groups update own" on public.groups;
create policy "groups update own" on public.groups
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- --- group_members: publicly readable (member list), self-managed ----------
drop policy if exists "group_members public read" on public.group_members;
create policy "group_members public read" on public.group_members
  for select using (true);

drop policy if exists "group_members insert self" on public.group_members;
create policy "group_members insert self" on public.group_members
  for insert with check (auth.uid() = user_id);

drop policy if exists "group_members delete self" on public.group_members;
create policy "group_members delete self" on public.group_members
  for delete using (auth.uid() = user_id);

-- --- events: public read, writes locked to backend --------------------------
drop policy if exists "events public read" on public.events;
create policy "events public read" on public.events
  for select using (true);

-- --- event_registrations: own rows only -------------------------------------
drop policy if exists "event_registrations select own" on public.event_registrations;
create policy "event_registrations select own" on public.event_registrations
  for select using (auth.uid() = user_id);

drop policy if exists "event_registrations insert own" on public.event_registrations;
create policy "event_registrations insert own" on public.event_registrations
  for insert with check (auth.uid() = user_id);

drop policy if exists "event_registrations delete own" on public.event_registrations;
create policy "event_registrations delete own" on public.event_registrations
  for delete using (auth.uid() = user_id);

-- --- wallet_transactions: read-only for the owner, NEVER client-writable ----
-- Balance is derived by summing this table (Phase F), so allowing clients to
-- insert their own rows would let anyone grant themselves free credit. Every
-- row is written by a backend function (service role) only.
drop policy if exists "wallet_transactions select own" on public.wallet_transactions;
create policy "wallet_transactions select own" on public.wallet_transactions
  for select using (auth.uid() = user_id);

-- --- referrals: user can create/see their own invites, status is backend-only
drop policy if exists "referrals select own" on public.referrals;
create policy "referrals select own" on public.referrals
  for select using (auth.uid() = referrer_user_id);

drop policy if exists "referrals insert own" on public.referrals;
create policy "referrals insert own" on public.referrals
  for insert with check (auth.uid() = referrer_user_id);
-- No update/delete policy for clients: status transitions to 'joined' and
-- 'first_booking_complete' — and the resulting wallet_transactions row —
-- are written by a backend function once it verifies the referred phone
-- actually completed a booking.

-- ============================================================================
-- End of Phase A
-- ============================================================================