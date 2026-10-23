-- ============================================================================
-- Venue community group → photos, videos and files in the chat
-- ============================================================================
-- Adds attachments to venue_group_messages and a PRIVATE storage bucket for
-- them. Files live under <group_id>/… in the bucket; only people who can read
-- the group (its members while it is live, and the venue's partners) can view
-- them, and only people who may post (members when "members can post" is on,
-- and the venue's owner/staff) can upload. The app shows files through
-- short-lived signed URLs.
-- Apply after 20261023030000_venue_group_two_way_chat.sql. Safe to re-run.
-- ============================================================================

alter table public.venue_group_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists media_path   text,
  add column if not exists file_name    text,
  add column if not exists file_size    bigint,
  add column if not exists mime_type    text;

alter table public.venue_group_messages drop constraint if exists venue_group_messages_type_check;
alter table public.venue_group_messages add constraint venue_group_messages_type_check
  check (message_type in ('text', 'image', 'video', 'file'));

-- Old rule: body must be 1..1000 chars. Attachments may have no caption, so:
-- text messages still need a body; everything is capped at 1000.
alter table public.venue_group_messages drop constraint if exists venue_group_messages_body_len;
alter table public.venue_group_messages add constraint venue_group_messages_body_len
  check (
    char_length(body) <= 1000
    and (message_type <> 'text' or char_length(trim(body)) >= 1)
  );

-- ── Who may post? ─────────────────────────────────────────────────────────
create or replace function public.venue_group_can_post(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- the venue's own partners, while the facility is on and the group active
    exists (
      select 1 from public.venue_groups g
      where g.id = p_group_id
        and g.is_active
        and public.venue_group_access_enabled(g.venue_id)
        and public.partner_role_for_venue(g.venue_id) is not null
    )
    or
    -- members of a live group the owner has left open for posting
    (
      public.venue_group_is_live(p_group_id)
      and exists (
        select 1 from public.venue_groups g
        where g.id = p_group_id and g.members_can_post
      )
      and exists (
        select 1 from public.venue_group_members m
        where m.group_id = p_group_id and m.user_id = auth.uid()
      )
    );
$$;

grant execute on function public.venue_group_can_post(uuid) to authenticated;

-- ── Storage bucket + policies ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'venue-group-chat', 'venue-group-chat', false, 26214400,
  array[
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','video/webm','video/quicktime',
    'application/pdf','text/plain','text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "venue group media read" on storage.objects;
create policy "venue group media read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'venue-group-chat'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.venue_group_can_read(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

drop policy if exists "venue group media upload" on storage.objects;
create policy "venue group media upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'venue-group-chat'
    and case
      when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.venue_group_can_post(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

-- ── Send an attachment ────────────────────────────────────────────────────
-- Members: send_venue_group_media. Owner: partner_send_venue_group_media.
-- Both check the file really sits in THIS group's folder.
create or replace function public._venue_group_check_media(
  p_group_id uuid, p_type text, p_path text, p_body text
)
returns void
language plpgsql
immutable
as $$
begin
  if p_type not in ('image', 'video', 'file') then raise exception 'INVALID_MESSAGE_TYPE'; end if;
  if p_path is null or p_path not like p_group_id::text || '/%' then
    raise exception 'INVALID_MEDIA_PATH';
  end if;
  if char_length(coalesce(p_body, '')) > 1000 then raise exception 'MESSAGE_TOO_LONG'; end if;
end;
$$;

revoke all on function public._venue_group_check_media(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.send_venue_group_media(
  p_group_id  uuid,
  p_type      text,
  p_path      text,
  p_file_name text,
  p_file_size bigint,
  p_mime_type text,
  p_body      text default null
)
returns public.venue_group_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row  public.venue_group_messages;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.venue_group_is_live(p_group_id) then raise exception 'GROUP_UNAVAILABLE'; end if;
  if not exists (
    select 1 from public.venue_group_members where group_id = p_group_id and user_id = v_user
  ) then raise exception 'NOT_A_MEMBER'; end if;
  if not (select members_can_post from public.venue_groups where id = p_group_id) then
    raise exception 'MEMBERS_CANNOT_POST';
  end if;
  perform public._venue_group_check_media(p_group_id, p_type, p_path, p_body);

  if (
    select count(*) from public.venue_group_messages
    where group_id = p_group_id and sender_user_id = v_user
      and created_at > now() - interval '1 minute'
  ) >= 20 then raise exception 'TOO_FAST'; end if;

  insert into public.venue_group_messages
    (group_id, body, sender_user_id, sender_kind, message_type, media_path, file_name, file_size, mime_type)
  values
    (p_group_id, trim(coalesce(p_body, '')), v_user, 'member', p_type, p_path,
     left(p_file_name, 200), p_file_size, p_mime_type)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.send_venue_group_media(uuid, text, text, text, bigint, text, text) to authenticated;

create or replace function public.partner_send_venue_group_media(
  p_group_id  uuid,
  p_type      text,
  p_path      text,
  p_file_name text,
  p_file_size bigint,
  p_mime_type text,
  p_body      text default null
)
returns public.venue_group_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue  uuid;
  v_active boolean;
  v_row    public.venue_group_messages;
begin
  select venue_id, is_active into v_venue, v_active from public.venue_groups where id = p_group_id;
  if v_venue is null then raise exception 'GROUP_NOT_FOUND'; end if;

  perform public._venue_group_assert_owner(v_venue);

  if not public.venue_group_access_enabled(v_venue) then raise exception 'FEATURE_NOT_ENABLED'; end if;
  if not v_active then raise exception 'GROUP_PAUSED'; end if;
  perform public._venue_group_check_media(p_group_id, p_type, p_path, p_body);

  insert into public.venue_group_messages
    (group_id, body, sender_kind, message_type, media_path, file_name, file_size, mime_type)
  values
    (p_group_id, trim(coalesce(p_body, '')), 'venue', p_type, p_path,
     left(p_file_name, 200), p_file_size, p_mime_type)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.partner_send_venue_group_media(uuid, text, text, text, bigint, text, text) to authenticated;
