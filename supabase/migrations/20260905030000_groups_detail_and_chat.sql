-- Groups detail page + chat fix.
--
-- Two things were missing entirely:
--  1) join_group() let anyone into a "private" group directly — privacy
--     was stored on the group row but never actually checked anywhere.
--  2) There was no chat table/RPC at all.
--
-- Phone-number safety note (this migration touches nothing that changes
-- this, but it's the load-bearing fact the rest of this feature relies
-- on): public.users.phone is never selectable by anyone but its own row
-- owner (see "users select own" in 20260829000000_phase_a_schema.sql).
-- Every other-user lookup in this app already goes through
-- public.public_profiles, a view exposing only (id, name,
-- profile_photo_url) — no phone column exists on that view at all, so a
-- client literally cannot select a phone number for anyone but itself,
-- no matter what it asks for. Chat sender identity below reuses that same
-- view for exactly this reason.

-- ============================================================================
-- 1. Private-group join requests
-- ============================================================================

create table if not exists public.group_join_requests (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  requested_at timestamptz not null default now(),

  constraint group_join_requests_unique unique (group_id, user_id)
);

alter table public.group_join_requests enable row level security;

-- No insert/delete policy here on purpose — every write goes through the
-- RPCs below (security definer), so a request can never be forged for
-- someone else and only a real group admin can ever approve/reject one.
drop policy if exists "group_join_requests select own or admin" on public.group_join_requests;
create policy "group_join_requests select own or admin" on public.group_join_requests
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = group_join_requests.group_id
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
  );

-- join_group's signature changes (jsonb return instead of a bare groups
-- row, so the client can tell "joined immediately" apart from "pending
-- approval") — drop first since Postgres won't let create-or-replace
-- change a function's return type in place.
drop function if exists public.join_group(uuid);

create or replace function public.join_group(p_group_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_privacy text;
  v_group   public.groups;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  select privacy into v_privacy from public.groups where id = p_group_id for update;
  if v_privacy is null then raise exception 'GROUP_NOT_FOUND'; end if;

  -- Already a member — idempotent success, no duplicate request either.
  if exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = v_user_id
  ) then
    select * into v_group from public.groups where id = p_group_id;
    return jsonb_build_object('status', 'joined', 'group', to_jsonb(v_group));
  end if;

  if v_privacy = 'private' then
    insert into public.group_join_requests (group_id, user_id)
    values (p_group_id, v_user_id)
    on conflict (group_id, user_id) do nothing;
    return jsonb_build_object('status', 'pending');
  end if;

  insert into public.group_members (group_id, user_id)
  values (p_group_id, v_user_id)
  on conflict (group_id, user_id) do nothing;

  update public.groups
  set member_count = (select count(*) from public.group_members where group_id = p_group_id)
  where id = p_group_id
  returning * into v_group;

  return jsonb_build_object('status', 'joined', 'group', to_jsonb(v_group));
end;
$$;

grant execute on function public.join_group(uuid) to authenticated;

create or replace function public.approve_group_join_request(p_group_id uuid, p_user_id uuid)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_group public.groups;
begin
  if v_admin is null then raise exception 'AUTH_REQUIRED'; end if;

  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = v_admin and role = 'admin'
  ) then
    raise exception 'NOT_ADMIN';
  end if;

  if not exists (
    select 1 from public.group_join_requests where group_id = p_group_id and user_id = p_user_id
  ) then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  insert into public.group_members (group_id, user_id)
  values (p_group_id, p_user_id)
  on conflict (group_id, user_id) do nothing;

  delete from public.group_join_requests where group_id = p_group_id and user_id = p_user_id;

  update public.groups
  set member_count = (select count(*) from public.group_members where group_id = p_group_id)
  where id = p_group_id
  returning * into v_group;

  return v_group;
end;
$$;

grant execute on function public.approve_group_join_request(uuid, uuid) to authenticated;

create or replace function public.reject_group_join_request(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
begin
  if v_admin is null then raise exception 'AUTH_REQUIRED'; end if;

  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = v_admin and role = 'admin'
  ) then
    raise exception 'NOT_ADMIN';
  end if;

  delete from public.group_join_requests where group_id = p_group_id and user_id = p_user_id;
end;
$$;

grant execute on function public.reject_group_join_request(uuid, uuid) to authenticated;

-- One seeded group ("Kanpur Tennis Society") was marked private with no
-- real admin (system-seeded groups have created_by = null and no
-- group_members rows at all — see 20260904020000_groups_seed_demo_data.sql)
-- which would make it permanently unjoinable: nobody could ever approve a
-- request. Flip it to public so it's actually usable; this only touches
-- the row while it's still system-owned (created_by is null), so it will
-- never silently override a real admin's deliberate privacy choice later.
update public.groups
set privacy = 'public'
where id = '22222222-2222-2222-2222-222222222205' and created_by is null;

-- ============================================================================
-- 2. Group chat
-- ============================================================================

create table if not exists public.group_messages (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups (id) on delete cascade,
  sender_user_id  uuid not null references public.users (id) on delete cascade,
  message_text    text not null check (length(trim(message_text)) > 0),
  created_at      timestamptz not null default now()
);

create index if not exists group_messages_group_id_idx on public.group_messages (group_id, created_at);

alter table public.group_messages enable row level security;

-- Members-only, both directions. No insert policy: every write goes
-- through send_group_message() below, so sender_user_id can never be
-- spoofed and a non-member can never post by crafting a raw insert.
drop policy if exists "group_messages select members only" on public.group_messages;
create policy "group_messages select members only" on public.group_messages
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_messages.group_id and gm.user_id = auth.uid()
    )
  );

create or replace function public.send_group_message(p_group_id uuid, p_message text)
returns public.group_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row  public.group_messages;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_message is null or length(trim(p_message)) = 0 then raise exception 'MESSAGE_REQUIRED'; end if;

  if not exists (
    select 1 from public.group_members where group_id = p_group_id and user_id = v_user
  ) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.group_messages (group_id, sender_user_id, message_text)
  values (p_group_id, v_user, trim(p_message))
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.send_group_message(uuid, text) to authenticated;

-- Live updates: group_messages (new chat messages), group_members (roster
-- changes on join/leave/approve), and group_join_requests (a new pending
-- request appearing for an admin to see) all need to reach anyone
-- currently viewing that group without a manual refresh.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_messages'
  ) then
    alter publication supabase_realtime add table public.group_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_members'
  ) then
    alter publication supabase_realtime add table public.group_members;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_join_requests'
  ) then
    alter publication supabase_realtime add table public.group_join_requests;
  end if;
end $$;