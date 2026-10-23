-- ============================================================================
-- Venue community group → two-way chat
-- ============================================================================
-- Members can now post in the group, not just read the owner's updates.
--  * venue_group_messages gets sender_user_id + sender_kind ('venue' | 'member').
--    Messages posted by the venue owner/staff stay anonymous ("the venue", no
--    partner identity exposed); member messages carry the member's user id so
--    the chat can show names.
--  * venue_groups.members_can_post lets the owner flip the group back to
--    "announcements only" at any time (default: members CAN post).
--  * Owner can delete any message (already existed). Members can delete
--    their own. A light per-user rate limit blocks flooding.
-- Safe to re-run. Apply after 20261023000000_venue_community_group.sql.
-- ============================================================================

alter table public.venue_group_messages
  add column if not exists sender_user_id uuid references public.users (id) on delete set null,
  add column if not exists sender_kind    text not null default 'venue';

alter table public.venue_group_messages drop constraint if exists venue_group_messages_sender_kind_check;
alter table public.venue_group_messages add constraint venue_group_messages_sender_kind_check
  check (sender_kind in ('venue', 'member'));

create index if not exists venue_group_messages_sender_idx
  on public.venue_group_messages (sender_user_id);

alter table public.venue_groups
  add column if not exists members_can_post boolean not null default true;

-- ── Consumer RPCs ─────────────────────────────────────────────────────────

-- get_venue_group now also reports whether members may post. The return type
-- changes, so the function has to be dropped and recreated.
drop function if exists public.get_venue_group(uuid);

create function public.get_venue_group(p_venue_id uuid)
returns table (
  id               uuid,
  venue_id         uuid,
  name             text,
  description      text,
  member_count     bigint,
  is_member        boolean,
  created_at       timestamptz,
  members_can_post boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    g.venue_id,
    g.name::text,
    g.description::text,
    (select count(*) from public.venue_group_members m where m.group_id = g.id),
    exists (
      select 1 from public.venue_group_members m
      where m.group_id = g.id and m.user_id = auth.uid()
    ),
    g.created_at,
    g.members_can_post
  from public.venue_groups g
  where g.venue_id = p_venue_id
    and public.venue_group_is_live(g.id);
$$;

grant execute on function public.get_venue_group(uuid) to anon, authenticated;

create or replace function public.send_venue_group_message(p_group_id uuid, p_body text)
returns public.venue_group_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_body text := trim(coalesce(p_body, ''));
  v_row  public.venue_group_messages;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  if not public.venue_group_is_live(p_group_id) then
    raise exception 'GROUP_UNAVAILABLE';
  end if;
  if not exists (
    select 1 from public.venue_group_members
    where group_id = p_group_id and user_id = v_user
  ) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if not (select members_can_post from public.venue_groups where id = p_group_id) then
    raise exception 'MEMBERS_CANNOT_POST';
  end if;

  if v_body = '' then raise exception 'MESSAGE_REQUIRED'; end if;
  if char_length(v_body) > 1000 then raise exception 'MESSAGE_TOO_LONG'; end if;

  -- Flood guard: at most 20 messages per user per minute per group.
  if (
    select count(*) from public.venue_group_messages
    where group_id = p_group_id and sender_user_id = v_user
      and created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'TOO_FAST';
  end if;

  insert into public.venue_group_messages (group_id, body, sender_user_id, sender_kind)
  values (p_group_id, v_body, v_user, 'member')
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.send_venue_group_message(uuid, text) to authenticated;

-- A member can remove their own message.
create or replace function public.delete_my_venue_group_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  delete from public.venue_group_messages
  where id = p_message_id and sender_user_id = auth.uid() and sender_kind = 'member';
end;
$$;

grant execute on function public.delete_my_venue_group_message(uuid) to authenticated;

-- ── Partner (owner) RPC ───────────────────────────────────────────────────

create or replace function public.partner_set_venue_group_members_can_post(
  p_group_id uuid,
  p_allowed  boolean
)
returns public.venue_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue uuid;
  v_row   public.venue_groups;
begin
  select venue_id into v_venue from public.venue_groups where id = p_group_id;
  if v_venue is null then raise exception 'GROUP_NOT_FOUND'; end if;

  perform public._venue_group_assert_owner(v_venue);

  update public.venue_groups
  set members_can_post = coalesce(p_allowed, true), updated_at = now()
  where id = p_group_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.partner_set_venue_group_members_can_post(uuid, boolean) to authenticated;
