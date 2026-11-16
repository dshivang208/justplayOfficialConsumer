-- Suggestion box: players (or visitors) send ideas from the consumer app;
-- admins review them in the admin app.

create table if not exists public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users (id) on delete set null,
  name        text not null check (length(trim(name)) > 0 and length(name) <= 100),
  email       text check (email is null or length(email) <= 200),
  category    text not null default 'feature'
              check (category in ('feature','venue','app','booking','other')),
  message     text not null check (length(trim(message)) between 10 and 2000),
  status      text not null default 'new'
              check (status in ('new','reviewed','planned','done','dismissed')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists suggestions_status_created_idx
  on public.suggestions (status, created_at desc);

alter table public.suggestions enable row level security;

-- Anyone can submit; a logged-in user can only attach their own id.
drop policy if exists "suggestions insert" on public.suggestions;
create policy "suggestions insert" on public.suggestions
  for insert to anon, authenticated
  with check (
    status = 'new' and admin_note is null
    and (user_id is null or user_id = auth.uid())
  );

-- Only admins can read / triage.
drop policy if exists "suggestions admin select" on public.suggestions;
create policy "suggestions admin select" on public.suggestions
  for select to authenticated using (public.is_admin());

drop policy if exists "suggestions admin update" on public.suggestions;
create policy "suggestions admin update" on public.suggestions
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "suggestions admin delete" on public.suggestions;
create policy "suggestions admin delete" on public.suggestions
  for delete to authenticated using (public.is_admin());

grant insert on public.suggestions to anon, authenticated;
grant select, update, delete on public.suggestions to authenticated;

create or replace function public._suggestions_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_suggestions_touch on public.suggestions;
create trigger trg_suggestions_touch before update on public.suggestions
  for each row execute function public._suggestions_touch();

-- Live updates in the admin inbox.
do $$ begin
  alter publication supabase_realtime add table public.suggestions;
exception when duplicate_object then null; when undefined_object then null; end $$;
