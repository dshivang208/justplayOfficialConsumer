-- ============================================================================
-- JustPlay — Host a game upgrades
--   1. "Venue already booked" option on hosted games
--   2. Friends (request / accept), contact matching, and game invites
-- Safe to re-run. Run AFTER 20261028000000_group_message_push.sql (needs the 6-arg _push_enqueue).
-- ============================================================================

-- 1. Pre-booked flag ---------------------------------------------------------
alter table public.hosted_games
  add column if not exists venue_pre_booked boolean not null default false;

drop function if exists public.create_hosted_game(uuid, text, date, text, integer, text, text, integer, text, text);

create or replace function public.create_hosted_game(
  p_venue_id        uuid,
  p_sport           text,
  p_date            date,
  p_time            text,
  p_total_spots     integer,
  p_skill_level     text,
  p_cost_type       text,
  p_total_cost      integer,
  p_description     text,
  p_join_policy     text,
  p_venue_pre_booked boolean default false
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
    skill_level, cost_type, total_cost, description, join_policy, venue_pre_booked
  )
  values (
    v_user, p_venue_id, p_sport, p_date, p_time, p_total_spots, 1,
    coalesce(nullif(p_skill_level, ''), 'Any'),
    coalesce(nullif(p_cost_type, ''), 'free'),
    greatest(coalesce(p_total_cost, 0), 0),
    p_description,
    coalesce(nullif(p_join_policy, ''), 'open'),
    coalesce(p_venue_pre_booked, false)
  )
  returning * into v_game;

  insert into public.game_participants (game_id, user_id, status)
  values (v_game.id, v_user, 'joined');

  return v_game;
end;
$$;
grant execute on function public.create_hosted_game(uuid, text, date, text, integer, text, text, integer, text, text, boolean) to authenticated;

-- 2. Friends -----------------------------------------------------------------
create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.users (id) on delete cascade,
  addressee_id  uuid not null references public.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;
drop policy if exists "friendships select own" on public.friendships;
create policy "friendships select own" on public.friendships
  for select to authenticated using (auth.uid() in (requester_id, addressee_id));
-- all writes go through the RPCs below

create or replace function public._phone10(p text)
returns text language sql immutable as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 10);
$$;

create or replace function public.my_friends()
returns table (user_id uuid, name text, phone text, photo_url text)
language sql stable security definer set search_path = public as $$
  select u.id, u.name, u.phone, u.profile_photo_url
  from public.friendships f
  join public.users u on u.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
    and coalesce(u.status, 'active') <> 'suspended'
  order by u.name;
$$;
grant execute on function public.my_friends() to authenticated;

create or replace function public.my_friend_requests()
returns table (request_id uuid, user_id uuid, name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, u.id, u.name, f.created_at
  from public.friendships f join public.users u on u.id = f.requester_id
  where f.addressee_id = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;
grant execute on function public.my_friend_requests() to authenticated;

-- Returns: sent | already_friends | already_pending | accepted | not_found | self
create or replace function public.send_friend_request(p_phone text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_other uuid;
  v_row public.friendships;
  v_name text;
begin
  if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
  if length(public._phone10(p_phone)) < 10 then return 'not_found'; end if;
  select id into v_other from public.users where public._phone10(phone) = public._phone10(p_phone) limit 1;
  if v_other is null then return 'not_found'; end if;
  if v_other = v_me then return 'self'; end if;

  select * into v_row from public.friendships
  where least(requester_id, addressee_id) = least(v_me, v_other)
    and greatest(requester_id, addressee_id) = greatest(v_me, v_other);
  if found then
    if v_row.status = 'accepted' then return 'already_friends'; end if;
    if v_row.addressee_id = v_me then
      update public.friendships set status = 'accepted' where id = v_row.id;
      return 'accepted';
    end if;
    return 'already_pending';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (v_me, v_other);
  select name into v_name from public.users where id = v_me;
  insert into public.user_notifications (user_id, message)
  values (v_other, coalesce(nullif(trim(v_name), ''), 'Someone') || ' sent you a friend request. Open Host a Game → Invite players to accept.');
  return 'sent';
end;
$$;
grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_row public.friendships; v_name text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_row from public.friendships where id = p_request_id and addressee_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Request not found.'; end if;
  if p_accept then
    update public.friendships set status = 'accepted' where id = v_row.id;
    select name into v_name from public.users where id = auth.uid();
    insert into public.user_notifications (user_id, message)
    values (v_row.requester_id, coalesce(nullif(trim(v_name), ''), 'Someone') || ' accepted your friend request.');
  else
    delete from public.friendships where id = v_row.id;
  end if;
end;
$$;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Which of these phone numbers (from the device's contacts) are on JustPlay?
create or replace function public.match_contacts(p_phones text[])
returns table (user_id uuid, name text, phone10 text, is_friend boolean)
language sql stable security definer set search_path = public as $$
  with wanted as (
    select distinct public._phone10(x) p from unnest(coalesce(p_phones, '{}'::text[])) x
    where length(public._phone10(x)) = 10 limit 1000
  )
  select u.id, u.name, public._phone10(u.phone),
         exists (select 1 from public.friendships f
                 where f.status = 'accepted'
                   and least(f.requester_id, f.addressee_id) = least(auth.uid(), u.id)
                   and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), u.id))
  from public.users u join wanted w on w.p = public._phone10(u.phone)
  where auth.uid() is not null and u.id <> auth.uid() and coalesce(u.status, 'active') <> 'suspended';
$$;
grant execute on function public.match_contacts(text[]) to authenticated;

-- 3. Game invites ------------------------------------------------------------
create table if not exists public.game_invites (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.hosted_games (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  invited_by  uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (game_id, user_id)
);
alter table public.game_invites enable row level security;
drop policy if exists "game_invites select own" on public.game_invites;
create policy "game_invites select own" on public.game_invites
  for select to authenticated using (auth.uid() in (user_id, invited_by));

create or replace function public.invite_players_to_game(p_game_id uuid, p_user_ids uuid[])
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_game public.hosted_games;
  v_host text;
  v_venue text;
  v_ids uuid[];
begin
  if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.hosted_games where id = p_game_id and host_user_id = v_me and status = 'active';
  if not found then raise exception 'Only the host can invite players.'; end if;

  select coalesce(array_agg(x), '{}') into v_ids from (
    select distinct u.id x from unnest(coalesce(p_user_ids, '{}'::uuid[])) i
    join public.users u on u.id = i
    where u.id <> v_me
      and not exists (select 1 from public.game_participants gp where gp.game_id = p_game_id and gp.user_id = u.id and gp.status = 'joined')
    limit 30
  ) s;
  if array_length(v_ids, 1) is null then return 0; end if;

  insert into public.game_invites (game_id, user_id, invited_by)
  select p_game_id, unnest(v_ids), v_me on conflict do nothing;

  select name into v_host from public.users where id = v_me;
  select name into v_venue from public.venues where id = v_game.venue_id;

  insert into public.user_notifications (user_id, message)
  select unnest(v_ids),
         coalesce(nullif(trim(v_host), ''), 'A friend') || ' invited you to play ' || v_game.sport
         || ' at ' || coalesce(v_venue, 'a venue') || ' on ' || to_char(v_game.date, 'DD Mon') || ', ' || v_game.time || '.';

  perform public._push_enqueue(
    v_ids, 'consumer', 'Game invite 🎮',
    coalesce(nullif(trim(v_host), ''), 'A friend') || ' invited you: ' || v_game.sport || ' at ' || coalesce(v_venue, 'a venue')
      || ', ' || to_char(v_game.date, 'DD Mon') || ' ' || v_game.time,
    '/games/' || p_game_id, 'invite-' || p_game_id
  );
  return array_length(v_ids, 1);
end;
$$;
grant execute on function public.invite_players_to_game(uuid, uuid[]) to authenticated;

-- Generic notification push must not double up on invites (they push themselves, with a deep link).
create or replace function public.trg_push_user_notification()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if to_jsonb(new)->>'notification_log_id' is null and new.message not like '% invited you to play %' then
    v_title := case
      when new.message ilike 'Booking confirmed%'            then 'Booking confirmed ✅'
      when new.message ilike '%was cancelled by the venue%'  then 'Booking cancelled'
      when new.message ilike '%friend request%'              then 'Friend request 👋'
      when new.message ilike '%point%'                       then 'Rewards update 🎁'
      when new.message ilike '%refund%'                      then 'Refund update'
      else 'JustPlay'
    end;
    perform public._push_enqueue(array[new.user_id], 'consumer', v_title, new.message, '/notifications');
  end if;
  return new;
exception when others then
  return new;
end;
$$;
