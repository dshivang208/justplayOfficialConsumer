-- Hosted Games "Manage" fix.
--
-- The Manage button on GameCard already navigated to /games/$gameId
-- correctly — the real gap was that almost none of the host-management
-- functionality it was supposed to open actually existed server-side:
-- there was no way to see or act on pending join requests, no way to
-- remove a joined player, and "Message players" only set local component
-- state (nothing was ever persisted, so joined players never actually saw
-- a message). This migration adds the missing backend pieces; the RLS
-- policies already in place for hosted_games (host-only column update) are
-- reused as-is for the "edit game details" part of Manage.

-- ============================================================================
-- 1. game_messages — real, persisted host -> joined-players broadcasts
-- ============================================================================

create table if not exists public.game_messages (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.hosted_games (id) on delete cascade,
  sender_id  uuid not null references public.users (id) on delete cascade,
  message    text not null check (length(trim(message)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists game_messages_game_id_idx on public.game_messages (game_id, created_at);

alter table public.game_messages enable row level security;

drop policy if exists "game_messages select for host or participant" on public.game_messages;
create policy "game_messages select for host or participant" on public.game_messages
  for select using (
    exists (
      select 1 from public.hosted_games hg
      where hg.id = game_messages.game_id and hg.host_user_id = auth.uid()
    )
    or exists (
      select 1 from public.game_participants gp
      where gp.game_id = game_messages.game_id and gp.user_id = auth.uid() and gp.status = 'joined'
    )
  );

-- No insert/update/delete policy is granted directly: every write goes
-- through send_game_message() below (security definer), so sender_id can
-- never be spoofed and only the real host of the game can ever post.

-- ============================================================================
-- 2. Host actions on pending requests and joined players
-- ============================================================================

create or replace function public.approve_join_request(p_game_id uuid, p_user_id uuid)
returns public.hosted_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid := auth.uid();
  v_game public.hosted_games;
begin
  if v_host is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.hosted_games where id = p_game_id for update;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.host_user_id <> v_host then raise exception 'NOT_HOST'; end if;
  if v_game.status <> 'active' then raise exception 'GAME_NOT_ACTIVE'; end if;

  if not exists (
    select 1 from public.game_participants
    where game_id = p_game_id and user_id = p_user_id and status = 'requested'
  ) then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if v_game.spots_filled >= v_game.total_spots then
    raise exception 'GAME_FULL';
  end if;

  update public.game_participants
  set status = 'joined'
  where game_id = p_game_id and user_id = p_user_id;

  update public.hosted_games
  set spots_filled = (
    select count(*) from public.game_participants where game_id = p_game_id and status = 'joined'
  )
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

grant execute on function public.approve_join_request(uuid, uuid) to authenticated;

create or replace function public.reject_join_request(p_game_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid := auth.uid();
begin
  if v_host is null then raise exception 'AUTH_REQUIRED'; end if;

  if not exists (
    select 1 from public.hosted_games where id = p_game_id and host_user_id = v_host
  ) then
    raise exception 'NOT_HOST';
  end if;

  delete from public.game_participants
  where game_id = p_game_id and user_id = p_user_id and status = 'requested';
end;
$$;

grant execute on function public.reject_join_request(uuid, uuid) to authenticated;

create or replace function public.remove_game_participant(p_game_id uuid, p_user_id uuid)
returns public.hosted_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid := auth.uid();
  v_game public.hosted_games;
begin
  if v_host is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_game from public.hosted_games where id = p_game_id for update;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.host_user_id <> v_host then raise exception 'NOT_HOST'; end if;
  if p_user_id = v_host then raise exception 'CANNOT_REMOVE_HOST'; end if;

  delete from public.game_participants where game_id = p_game_id and user_id = p_user_id;

  update public.hosted_games
  set spots_filled = (
    select count(*) from public.game_participants where game_id = p_game_id and status = 'joined'
  )
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

grant execute on function public.remove_game_participant(uuid, uuid) to authenticated;

-- ============================================================================
-- 3. Broadcast messaging
-- ============================================================================

create or replace function public.send_game_message(p_game_id uuid, p_message text)
returns public.game_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid := auth.uid();
  v_row  public.game_messages;
begin
  if v_host is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_message is null or length(trim(p_message)) = 0 then raise exception 'MESSAGE_REQUIRED'; end if;

  if not exists (
    select 1 from public.hosted_games where id = p_game_id and host_user_id = v_host
  ) then
    raise exception 'NOT_HOST';
  end if;

  insert into public.game_messages (game_id, sender_id, message)
  values (p_game_id, v_host, trim(p_message))
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.send_game_message(uuid, text) to authenticated;

-- ============================================================================
-- 5. Atomic game creation — hostGame() had the same bug class as the
--    groups fix from the previous phase: two separate, unlinked inserts
--    (hosted_games, then game_participants for the host), with the second
--    insert's result never checked. If it silently failed, the game would
--    exist with spots_filled = 1 but the host wouldn't actually be a row
--    in game_participants — breaking "my games", the participant list, and
--    every later host-only action that expects the host to be a member.
-- ============================================================================

create or replace function public.create_hosted_game(
  p_venue_id    uuid,
  p_sport       text,
  p_date        date,
  p_time        text,
  p_total_spots integer,
  p_skill_level text,
  p_cost_type   text,
  p_total_cost  integer,
  p_description text,
  p_join_policy text
)
returns public.hosted_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_game public.hosted_games;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_venue_id is null then raise exception 'A venue is required.'; end if;
  if p_total_spots is null or p_total_spots < 1 then raise exception 'Total spots must be at least 1.'; end if;

  insert into public.hosted_games (
    host_user_id, venue_id, sport, date, time, total_spots, spots_filled,
    skill_level, cost_type, total_cost, description, join_policy
  )
  values (
    v_user, p_venue_id, p_sport, p_date, p_time, p_total_spots, 1,
    coalesce(nullif(p_skill_level, ''), 'Any'),
    coalesce(nullif(p_cost_type, ''), 'free'),
    coalesce(p_total_cost, 0),
    p_description,
    coalesce(nullif(p_join_policy, ''), 'open')
  )
  returning * into v_game;

  -- Host counts as the first joined player — same transaction, so a
  -- failure here rolls the game insert back too.
  insert into public.game_participants (game_id, user_id, status)
  values (v_game.id, v_user, 'joined');

  return v_game;
end;
$$;

grant execute on function public.create_hosted_game(uuid, text, date, text, integer, text, text, integer, text, text) to authenticated;

-- ============================================================================
-- 6. Live updates: joined players see new host messages and roster changes
--    without refreshing, same pattern as the earlier hosted-games realtime
--    fix (see 20260904000000_realtime_hosted_games.sql).
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_messages'
  ) then
    alter publication supabase_realtime add table public.game_messages;
  end if;
end $$;