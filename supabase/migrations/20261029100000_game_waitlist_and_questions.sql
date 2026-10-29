-- ============================================================================
-- JustPlay — Hosted games: waiting list + public "ask a question" thread
--   * Open games that are full get a waiting list. When a spot frees up
--     (player leaves, host removes someone, host adds spots) the first person
--     in line is moved in automatically and told by notification + push.
--   * game_questions: anyone signed in can ask the host / other players a
--     question on the game page; host and players get notified.
-- Run AFTER 20261028000000_group_message_push.sql. Safe to re-run.
-- ============================================================================

-- 1. Waitlist status ----------------------------------------------------------
alter table public.game_participants drop constraint if exists game_participants_status_check;
alter table public.game_participants add constraint game_participants_status_check
  check (status in ('joined', 'requested', 'waitlisted'));

-- Moves people off the waiting list while there are free spots (open games only).
-- Caller already holds the hosted_games row lock.
create or replace function public._promote_waitlist(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.hosted_games;
  v_next uuid;
  v_venue text;
begin
  select * into g from public.hosted_games where id = p_game_id;
  if not found or g.status <> 'active' or g.join_policy <> 'open' or g.date < current_date then return; end if;
  select name into v_venue from public.venues where id = g.venue_id;

  loop
    select count(*) into g.spots_filled from public.game_participants where game_id = p_game_id and status = 'joined';
    exit when g.spots_filled >= g.total_spots;

    select user_id into v_next from public.game_participants
    where game_id = p_game_id and status = 'waitlisted'
    order by joined_at, id limit 1
    for update skip locked;
    exit when v_next is null;

    update public.game_participants set status = 'joined', joined_at = now()
    where game_id = p_game_id and user_id = v_next;

    insert into public.user_notifications (user_id, message)
    values (v_next, 'A spot opened up — you''re in off the waitlist! ' || g.sport || ' at '
            || coalesce(v_venue, 'the venue') || ', ' || to_char(g.date, 'DD Mon') || ' ' || g.time || '.');
    perform public._push_enqueue(array[v_next], 'consumer', 'You''re in! 🎉',
      'A spot opened up — you''re off the waitlist for ' || g.sport || ' at ' || coalesce(v_venue, 'the venue')
        || ', ' || to_char(g.date, 'DD Mon') || ' ' || g.time,
      '/games/' || p_game_id, 'game-' || p_game_id);
  end loop;

  update public.hosted_games
  set spots_filled = (select count(*) from public.game_participants where game_id = p_game_id and status = 'joined')
  where id = p_game_id;
end;
$$;
revoke all on function public._promote_waitlist(uuid) from public, anon, authenticated;

create or replace function public.join_game_waitlist(p_game_id uuid)
returns integer   -- the caller's place in line (1 = next)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  g public.hosted_games;
  v_pos integer;
begin
  if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into g from public.hosted_games where id = p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if g.status <> 'active' then raise exception 'GAME_NOT_ACTIVE'; end if;
  if g.date < current_date then raise exception 'GAME_ALREADY_HAPPENED'; end if;
  if g.join_policy <> 'open' then raise exception 'WAITLIST_NOT_AVAILABLE'; end if;
  if exists (select 1 from public.game_participants where game_id = p_game_id and user_id = v_me and status in ('joined', 'requested')) then
    raise exception 'ALREADY_IN_GAME';
  end if;
  if g.spots_filled < g.total_spots then raise exception 'GAME_NOT_FULL'; end if;
  if (select count(*) from public.game_participants where game_id = p_game_id and status = 'waitlisted') >= 50 then
    raise exception 'WAITLIST_FULL';
  end if;

  insert into public.game_participants (game_id, user_id, status)
  values (p_game_id, v_me, 'waitlisted')
  on conflict (game_id, user_id) do nothing;

  select count(*) into v_pos
  from public.game_participants w, public.game_participants x
  where x.game_id = p_game_id and x.user_id = v_me
    and w.game_id = p_game_id and w.status = 'waitlisted'
    and (w.joined_at, w.id) <= (x.joined_at, x.id);
  return v_pos;
end;
$$;
grant execute on function public.join_game_waitlist(uuid) to authenticated;

-- leave: also promotes the next person in line
create or replace function public.leave_hosted_game(p_game_id uuid)
returns public.hosted_games
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_game    public.hosted_games;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  perform 1 from public.hosted_games where id = p_game_id for update;

  delete from public.game_participants where game_id = p_game_id and user_id = v_user_id;

  update public.hosted_games
  set spots_filled = (select count(*) from public.game_participants where game_id = p_game_id and status = 'joined')
  where id = p_game_id
  returning * into v_game;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;

  perform public._promote_waitlist(p_game_id);
  select * into v_game from public.hosted_games where id = p_game_id;
  return v_game;
end;
$$;
grant execute on function public.leave_hosted_game(uuid) to authenticated;

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
  set spots_filled = (select count(*) from public.game_participants where game_id = p_game_id and status = 'joined')
  where id = p_game_id;

  perform public._promote_waitlist(p_game_id);
  select * into v_game from public.hosted_games where id = p_game_id;
  return v_game;
end;
$$;
grant execute on function public.remove_game_participant(uuid, uuid) to authenticated;

-- host adds spots -> people waiting get in
create or replace function public.trg_game_spots_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.total_spots > old.total_spots then
    perform public._promote_waitlist(new.id);
  end if;
  return null;
exception when others then
  return null;
end;
$$;
drop trigger if exists trg_game_spots_changed on public.hosted_games;
create trigger trg_game_spots_changed
  after update of total_spots on public.hosted_games
  for each row when (new.total_spots is distinct from old.total_spots)
  execute function public.trg_game_spots_changed();

-- 2. Questions thread ---------------------------------------------------------
create table if not exists public.game_questions (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.hosted_games (id) on delete cascade,
  sender_id   uuid not null references public.users (id) on delete cascade,
  message     text not null check (char_length(trim(message)) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists game_questions_game_idx on public.game_questions (game_id, created_at);

alter table public.game_questions enable row level security;
drop policy if exists "game_questions read" on public.game_questions;
create policy "game_questions read" on public.game_questions for select to authenticated using (true);
-- writes only through the RPCs below

create or replace function public.post_game_question(p_game_id uuid, p_message text)
returns public.game_questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  g public.hosted_games;
  v_row public.game_questions;
  v_name text;
  v_msg text := trim(coalesce(p_message, ''));
  v_ids uuid[];
begin
  if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(v_msg) = 0 then raise exception 'MESSAGE_REQUIRED'; end if;
  if char_length(v_msg) > 500 then raise exception 'MESSAGE_TOO_LONG'; end if;
  select * into g from public.hosted_games where id = p_game_id;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if g.status = 'cancelled' then raise exception 'GAME_NOT_ACTIVE'; end if;
  if (select count(*) from public.game_questions where game_id = p_game_id and sender_id = v_me
        and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'TOO_MANY_MESSAGES';
  end if;

  insert into public.game_questions (game_id, sender_id, message) values (p_game_id, v_me, v_msg)
  returning * into v_row;

  select name into v_name from public.users where id = v_me;
  v_name := coalesce(nullif(trim(v_name), ''), 'Someone');

  -- host + joined players + earlier participants of this thread, except the sender
  select coalesce(array_agg(distinct x), '{}') into v_ids from (
    select g.host_user_id x
    union select user_id from public.game_participants where game_id = p_game_id and status = 'joined'
    union select sender_id from public.game_questions where game_id = p_game_id and created_at > now() - interval '7 days'
  ) s where x is not null and x <> v_me;

  if g.host_user_id <> v_me then
    insert into public.user_notifications (user_id, message)
    values (g.host_user_id, v_name || ' asked in your ' || g.sport || ' game: ' || left(v_msg, 120));
  end if;
  perform public._push_enqueue(v_ids, 'consumer', g.sport || ' game · ' || v_name,
    left(v_msg, 140), '/games/' || p_game_id, 'gq-' || p_game_id);
  return v_row;
end;
$$;
grant execute on function public.post_game_question(uuid, text) to authenticated;

create or replace function public.delete_game_question(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.game_questions q
  where q.id = p_id
    and (q.sender_id = auth.uid()
         or exists (select 1 from public.hosted_games g where g.id = q.game_id and g.host_user_id = auth.uid()));
end;
$$;
grant execute on function public.delete_game_question(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_questions') then
    alter publication supabase_realtime add table public.game_questions;
  end if;
end $$;

-- 3. Push title/skip rules (full replacement of the earlier versions) ---------
create or replace function public.trg_push_user_notification()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_title text;
begin
  if to_jsonb(new)->>'notification_log_id' is null
     and new.message not like '% invited you to play %'
     and new.message not like '%off the waitlist%'
     and new.message not like '% asked in your % game: %' then
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
