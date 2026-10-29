-- ============================================================================
-- JustPlay — friends management + safer invites
--   * remove_friend(): unfriend from the "My friends" page
--   * invite_players_to_game(): only NEW invitees get a notification/push
--     (re-inviting someone no longer spams them); returns how many were new
-- Run AFTER 20261028100000_host_game_friends_invites.sql. Safe to re-run.
-- ============================================================================

create or replace function public.remove_friend(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.friendships
  where least(requester_id, addressee_id) = least(auth.uid(), p_user_id)
    and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user_id);
end;
$$;
grant execute on function public.remove_friend(uuid) to authenticated;

create or replace function public.invite_players_to_game(p_game_id uuid, p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_game public.hosted_games;
  v_host text;
  v_venue text;
  v_new uuid[];
begin
  if v_me is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_game from public.hosted_games where id = p_game_id and host_user_id = v_me and status = 'active';
  if not found then raise exception 'Only the host can invite players.'; end if;
  if v_game.date < current_date then raise exception 'GAME_ALREADY_HAPPENED'; end if;

  with cand as (
    select distinct u.id
    from unnest(coalesce(p_user_ids, '{}'::uuid[])) i
    join public.users u on u.id = i
    where u.id <> v_me
      and not exists (select 1 from public.game_participants gp
                      where gp.game_id = p_game_id and gp.user_id = u.id and gp.status = 'joined')
    limit 30
  ), ins as (
    insert into public.game_invites (game_id, user_id, invited_by)
    select p_game_id, id, v_me from cand
    on conflict (game_id, user_id) do nothing
    returning user_id
  )
  select coalesce(array_agg(user_id), '{}') into v_new from ins;

  if array_length(v_new, 1) is null then return 0; end if;

  select name into v_host from public.users where id = v_me;
  select name into v_venue from public.venues where id = v_game.venue_id;

  insert into public.user_notifications (user_id, message)
  select unnest(v_new),
         coalesce(nullif(trim(v_host), ''), 'A friend') || ' invited you to play ' || v_game.sport
         || ' at ' || coalesce(v_venue, 'a venue') || ' on ' || to_char(v_game.date, 'DD Mon') || ', ' || v_game.time || '.';

  perform public._push_enqueue(
    v_new, 'consumer', 'Game invite 🎮',
    coalesce(nullif(trim(v_host), ''), 'A friend') || ' invited you: ' || v_game.sport || ' at ' || coalesce(v_venue, 'a venue')
      || ', ' || to_char(v_game.date, 'DD Mon') || ' ' || v_game.time,
    '/games/' || p_game_id, 'invite-' || p_game_id
  );
  return array_length(v_new, 1);
end;
$$;
grant execute on function public.invite_players_to_game(uuid, uuid[]) to authenticated;
