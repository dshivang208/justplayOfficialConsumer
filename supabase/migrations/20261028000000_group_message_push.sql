-- ============================================================================
-- JustPlay — push notifications for new group-chat messages (WhatsApp style)
--  * consumer groups            (group_messages)        -> every member except the sender
--  * venue community groups     (venue_group_messages)  -> members (consumer app) when the
--                                                          venue posts; the venue's partners
--                                                          (partner app) when a member posts
-- Needs 20261025010000_fcm_push.sql first. Safe to re-run.
-- ============================================================================

-- 1. _push_enqueue gets an optional tag (same tag = notifications stack per chat)
drop function if exists public._push_enqueue(uuid[], text, text, text, text);

create or replace function public._push_enqueue(
  p_user_ids uuid[], p_app text, p_title text, p_body text,
  p_url text default '/', p_tag text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.push_config;
begin
  select * into cfg from public.push_config where id;
  if not found or p_user_ids is null or array_length(p_user_ids, 1) is null then return; end if;
  if not exists (select 1 from public.push_tokens where user_id = any (p_user_ids) and app = p_app) then
    return;
  end if;

  perform net.http_post(
    url     := cfg.function_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret),
    body    := jsonb_build_object(
      'user_ids', to_jsonb(p_user_ids),
      'app',      p_app,
      'title',    left(coalesce(p_title, 'JustPlay'), 120),
      'body',     left(coalesce(p_body, ''), 300),
      'url',      coalesce(p_url, '/')
    ) || case when p_tag is null then '{}'::jsonb else jsonb_build_object('tag', p_tag) end
  );
exception when others then
  null;
end;
$$;
revoke all on function public._push_enqueue(uuid[], text, text, text, text, text) from public, anon, authenticated;

-- 2. Preview text shown in the notification
create or replace function public._chat_preview(p_type text, p_text text)
returns text
language sql
immutable
as $$
  select case coalesce(p_type, 'text')
    when 'image'   then '📷 Photo'
    when 'video'   then '🎥 Video'
    when 'gif'     then 'GIF'
    when 'sticker' then 'Sticker'
    when 'file'    then '📎 Document'
    else left(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'), 140)
  end;
$$;

-- 3. Consumer groups -> all members except the sender
create or replace function public.trg_push_group_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name   text;
  v_sender text;
  v_ids    uuid[];
begin
  select g.name into v_name from public.groups g where g.id = new.group_id;
  select u.name into v_sender from public.users u where u.id = new.sender_user_id;

  select coalesce(array_agg(m.user_id), '{}') into v_ids
  from public.group_members m
  where m.group_id = new.group_id and m.user_id is distinct from new.sender_user_id;

  perform public._push_enqueue(
    v_ids, 'consumer',
    coalesce(v_name, 'Group'),
    coalesce(nullif(trim(v_sender), ''), 'Someone') || ': ' || public._chat_preview(new.message_type, new.message_text),
    '/groups/' || new.group_id,
    'group-' || new.group_id
  );
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_push_group_message on public.group_messages;
create trigger trg_push_group_message
  after insert on public.group_messages
  for each row execute function public.trg_push_group_message();

-- 4. Venue community groups
create or replace function public.trg_push_venue_group_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name     text;
  v_venue    uuid;
  v_live     boolean;
  v_sender   text;
  v_preview  text;
  v_ids      uuid[];
begin
  select g.name, g.venue_id into v_name, v_venue from public.venue_groups g where g.id = new.group_id;
  v_preview := public._chat_preview(to_jsonb(new)->>'message_type', new.body);

  if coalesce(new.sender_kind, 'venue') = 'member' then
    -- a player wrote -> tell the venue's partners (owner + staff)
    select u.name into v_sender from public.users u where u.id = new.sender_user_id;
    select coalesce(array_agg(pv.partner_id), '{}') into v_ids
    from public.partner_venues pv where pv.venue_id = v_venue;

    perform public._push_enqueue(
      v_ids, 'partner',
      coalesce(v_name, 'Venue group'),
      coalesce(nullif(trim(v_sender), ''), 'A player') || ': ' || v_preview,
      '/dashboard/community',
      'vgroup-' || new.group_id
    );

    -- ...and the other members, WhatsApp style
    select coalesce(array_agg(m.user_id), '{}') into v_ids
    from public.venue_group_members m
    where m.group_id = new.group_id and m.user_id is distinct from new.sender_user_id;
    if public.venue_group_is_live(new.group_id) then
      perform public._push_enqueue(
        v_ids, 'consumer',
        coalesce(v_name, 'Venue group'),
        coalesce(nullif(trim(v_sender), ''), 'A player') || ': ' || v_preview,
        '/venue-group/' || v_venue,
        'vgroup-' || new.group_id
      );
    end if;
  else
    -- the venue posted -> every member (only while the group is live)
    if public.venue_group_is_live(new.group_id) then
      select coalesce(array_agg(m.user_id), '{}') into v_ids
      from public.venue_group_members m where m.group_id = new.group_id;
      perform public._push_enqueue(
        v_ids, 'consumer',
        coalesce(v_name, 'Venue group'),
        v_preview,
        '/venue-group/' || v_venue,
        'vgroup-' || new.group_id
      );
    end if;
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_push_venue_group_message on public.venue_group_messages;
create trigger trg_push_venue_group_message
  after insert on public.venue_group_messages
  for each row execute function public.trg_push_venue_group_message();
