-- Group chat media: photos, videos, GIFs and stickers.
--
--  * group_messages gets message_type + media columns. Text messages are
--    unchanged. A media message's caption (message_text) may be empty.
--  * Photos/videos live in a PRIVATE storage bucket, one folder per group
--    (<group_id>/<uuid>.<ext>); only members of that group can read or
--    upload there. The app shows them through short-lived signed URLs.
--  * GIFs picked from the GIF search are stored as an https GIPHY URL
--    (host-checked server-side); stickers are a short emoji string.
--  * Every write still goes through a SECURITY DEFINER function, so the
--    sender can't be spoofed and non-members can't post.

alter table public.group_messages drop constraint if exists group_messages_message_text_check;
alter table public.group_messages alter column message_text set default '';

alter table public.group_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists media_path   text,
  add column if not exists media_url    text;

alter table public.group_messages drop constraint if exists group_messages_type_check;
alter table public.group_messages add constraint group_messages_type_check
  check (message_type in ('text', 'image', 'video', 'gif', 'sticker'));

-- ── Storage bucket + member-only policies ────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-chat', 'group-chat', false, 26214400,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "group chat media read members" on storage.objects;
create policy "group chat media read members" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'group-chat'
    and exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid()
        and gm.group_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "group chat media upload members" on storage.objects;
create policy "group chat media upload members" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'group-chat'
    and exists (
      select 1 from public.group_members gm
      where gm.user_id = auth.uid()
        and gm.group_id::text = (storage.foldername(name))[1]
    )
  );

-- ── Send function for every message kind ─────────────────────────────────
create or replace function public.send_group_chat_message(
  p_group_id   uuid,
  p_type       text,
  p_text       text default null,
  p_media_path text default null,
  p_media_url  text default null
)
returns public.group_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_text text := trim(coalesce(p_text, ''));
  v_row  public.group_messages;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_type not in ('text', 'image', 'video', 'gif', 'sticker') then
    raise exception 'INVALID_MESSAGE_TYPE';
  end if;
  if not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = v_user
  ) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if length(v_text) > 2000 then raise exception 'MESSAGE_TOO_LONG'; end if;

  if p_type = 'text' then
    if v_text = '' then raise exception 'MESSAGE_REQUIRED'; end if;
    p_media_path := null; p_media_url := null;
  elsif p_type = 'sticker' then
    if v_text = '' or length(v_text) > 16 then raise exception 'INVALID_STICKER'; end if;
    p_media_path := null; p_media_url := null;
  elsif p_type in ('image', 'video') then
    -- The file must sit inside THIS group's folder in the bucket.
    if p_media_path is null or p_media_path not like p_group_id::text || '/%' then
      raise exception 'INVALID_MEDIA_PATH';
    end if;
    p_media_url := null;
  else -- gif
    if p_media_url is null or p_media_url !~* '^https://([a-z0-9-]+\.)*giphy\.com/' then
      raise exception 'INVALID_GIF_URL';
    end if;
    p_media_path := null;
  end if;

  insert into public.group_messages (group_id, sender_user_id, message_text, message_type, media_path, media_url)
  values (p_group_id, v_user, v_text, p_type, p_media_path, p_media_url)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.send_group_chat_message(uuid, text, text, text, text) from public, anon;
grant execute on function public.send_group_chat_message(uuid, text, text, text, text) to authenticated;
