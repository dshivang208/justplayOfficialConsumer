-- ============================================================================
-- JustPlay Consumer — stop joining/registering for games & events after
-- their date has passed
-- ============================================================================
-- join_hosted_game, approve_join_request and register_for_event only ever
-- checked `status <> 'active'` / participant caps. Nothing transitions a
-- hosted_games or events row to a different status once its date passes —
-- there's no cron job for it — so a game or event stayed status = 'active'
-- forever, and these functions kept accepting new joiners/registrants
-- indefinitely after it had already happened.
--
-- Fix: reject with a clear error once `date < current_date`. Leaving a game
-- (leave_hosted_game), unregistering (unregister_from_event), and rejecting
-- or removing someone (reject_join_request, remove_game_participant) are
-- deliberately left alone — there's no reason to block those after the
-- date passes.
--
-- CREATE OR REPLACE keeps existing GRANTs. Safe to re-run.
-- ============================================================================

create or replace function public.join_hosted_game(p_game_id uuid)
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

  select * into v_game from public.hosted_games where id = p_game_id for update;
  if v_game.id is null then raise exception 'GAME_NOT_FOUND'; end if;
  if v_game.status <> 'active' then raise exception 'GAME_NOT_ACTIVE'; end if;
  if v_game.date < current_date then raise exception 'GAME_ALREADY_HAPPENED'; end if;

  if v_game.join_policy = 'open' then
    if v_game.spots_filled >= v_game.total_spots then
      raise exception 'GAME_FULL';
    end if;
    insert into public.game_participants (game_id, user_id, status)
    values (p_game_id, v_user_id, 'joined')
    on conflict (game_id, user_id) do nothing;
  else
    insert into public.game_participants (game_id, user_id, status)
    values (p_game_id, v_user_id, 'requested')
    on conflict (game_id, user_id) do nothing;
  end if;

  update public.hosted_games
  set spots_filled = (
    select count(*) from public.game_participants
    where game_id = p_game_id and status = 'joined'
  )
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

grant execute on function public.join_hosted_game(uuid) to authenticated;

-- Also guard the approval path: without this, a request filed while the
-- game was still upcoming could still be approved by the host well after
-- the game happened, adding a "joined" player to a game that's long over.
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
  if v_game.date < current_date then raise exception 'GAME_ALREADY_HAPPENED'; end if;

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

create or replace function public.register_for_event(p_event_id uuid)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event   public.events;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_event from public.events where id = p_event_id for update;
  if v_event.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.date < current_date then raise exception 'EVENT_ALREADY_HAPPENED'; end if;
  if v_event.participant_count >= v_event.participant_limit then
    raise exception 'EVENT_FULL';
  end if;

  insert into public.event_registrations (event_id, user_id)
  values (p_event_id, v_user_id)
  on conflict (event_id, user_id) do nothing;

  update public.events
  set participant_count = (
    select count(*) from public.event_registrations where event_id = p_event_id
  )
  where id = p_event_id
  returning * into v_event;

  return v_event;
end;
$$;

grant execute on function public.register_for_event(uuid) to authenticated;