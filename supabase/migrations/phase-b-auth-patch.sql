-- ============================================================================
-- JustPlay — Backend Phase B patch: harden the Phase A signup trigger
-- ============================================================================
-- Run this AFTER phase-a-schema.sql (same project, SQL Editor or migration).
-- Idempotent — safe to re-run.
--
-- WHY: Backend Phase B mints sessions via a synthetic per-phone email
-- (see supabase/functions/mock-otp-verify), so `auth.users.phone` is not
-- set at signup time. Phase A's trigger fell back to an empty string in
-- that case, which — combined with `users.phone` being UNIQUE — created a
-- narrow race: two different brand-new phone numbers signing up in the
-- same instant could both try to insert phone=''. The Edge Function
-- immediately corrects the row to the real phone right after, so this was
-- never reachable in single-request practice, but there's no reason to
-- leave a collision path in a UNIQUE column. Falling back to the new
-- user's own id (always unique) closes it for good.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, phone, name)
  values (new.id, coalesce(nullif(new.phone, ''), new.id::text), '')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger itself is unchanged — re-declared only so this file is a
-- complete, standalone unit you can run on its own.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();