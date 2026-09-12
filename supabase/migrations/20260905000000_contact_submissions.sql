-- Contact page: persists form submissions (name, email, message). No email
-- sending yet — this just needs to land in the database reliably; wiring a
-- real notification (email/Slack webhook) is a separate, later piece.

create table if not exists public.contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  email      text not null check (length(trim(email)) > 0),
  message    text not null check (length(trim(message)) > 0),
  -- Set when the submitter happens to be logged in; null for a logged-out
  -- visitor. Never required — anyone should be able to reach support.
  user_id    uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

-- Anyone — logged in or not — can submit the contact form. There is
-- intentionally no select policy: submissions aren't readable through the
-- public API at all (not even by their own author), only via the Supabase
-- dashboard/service role. This is a write-only mailbox, not a ticket
-- history feature.
drop policy if exists "contact_submissions insert anyone" on public.contact_submissions;
create policy "contact_submissions insert anyone" on public.contact_submissions
  for insert
  to anon, authenticated
  with check (true);