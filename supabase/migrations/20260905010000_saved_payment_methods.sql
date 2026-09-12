-- "Add New Payment Method" fix.
--
-- Root cause: the button in Profile > Payment methods had no onClick at
-- all, and the list above it was rendered from a hardcoded module-level
-- mock array (never fetched from Supabase) left over from an early
-- mock-data phase. This migration adds the real table those methods
-- should have lived in all along.

create table if not exists public.saved_payment_methods (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  -- 'card' is accepted here for forward-compatibility, but nothing in the
  -- app can insert type='card' yet — raw card numbers are never collected
  -- or stored; the actual charge always goes through Razorpay's own
  -- hosted Checkout. Wiring a real "add card" flow means storing a
  -- Razorpay-vaulted token reference here, never a PAN.
  --
  -- For type='upi', this column holds the real UPI ID (e.g.
  -- "name@bank"), not a redacted version — UPI IDs aren't sensitive
  -- financial account numbers the way card PANs are, and storing it in
  -- full is what lets checkout offer it as a genuine quick-select option.
  type              text not null check (type in ('upi', 'card')),
  masked_identifier text not null check (length(trim(masked_identifier)) > 0),
  is_default        boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists saved_payment_methods_user_id_idx
  on public.saved_payment_methods (user_id);

-- At most one default per user, enforced atomically by Postgres itself —
-- not just application logic, which could race across two requests.
create unique index if not exists saved_payment_methods_one_default_per_user
  on public.saved_payment_methods (user_id) where (is_default);

alter table public.saved_payment_methods enable row level security;

drop policy if exists "saved_payment_methods select own" on public.saved_payment_methods;
create policy "saved_payment_methods select own" on public.saved_payment_methods
  for select using (auth.uid() = user_id);

drop policy if exists "saved_payment_methods insert own" on public.saved_payment_methods;
create policy "saved_payment_methods insert own" on public.saved_payment_methods
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_payment_methods delete own" on public.saved_payment_methods;
create policy "saved_payment_methods delete own" on public.saved_payment_methods
  for delete using (auth.uid() = user_id);

-- No direct update policy: changing which method is default always goes
-- through set_default_payment_method() below, so the "only one default"
-- invariant is changed atomically in one transaction instead of via two
-- separate, racy client writes (unset old one, set new one).

-- ============================================================================
-- Add a method — auto-defaults the very first one a user saves, and
-- atomically clears any existing default first if the caller asks for one.
-- ============================================================================

create or replace function public.add_payment_method(
  p_type              text,
  p_masked_identifier text,
  p_set_default       boolean default false
)
returns public.saved_payment_methods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user         uuid := auth.uid();
  v_row          public.saved_payment_methods;
  v_has_existing boolean;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_type not in ('upi', 'card') then raise exception 'Unsupported payment method type.'; end if;
  if p_masked_identifier is null or length(trim(p_masked_identifier)) = 0 then
    raise exception 'A payment identifier is required.';
  end if;

  select exists(
    select 1 from public.saved_payment_methods where user_id = v_user
  ) into v_has_existing;

  if p_set_default or not v_has_existing then
    update public.saved_payment_methods set is_default = false
    where user_id = v_user and is_default;
  end if;

  insert into public.saved_payment_methods (user_id, type, masked_identifier, is_default)
  values (v_user, p_type, trim(p_masked_identifier), p_set_default or not v_has_existing)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.add_payment_method(text, text, boolean) to authenticated;

create or replace function public.set_default_payment_method(p_method_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  if not exists (
    select 1 from public.saved_payment_methods where id = p_method_id and user_id = v_user
  ) then
    raise exception 'METHOD_NOT_FOUND';
  end if;

  update public.saved_payment_methods set is_default = false
  where user_id = v_user and is_default;

  update public.saved_payment_methods set is_default = true
  where id = p_method_id;
end;
$$;

grant execute on function public.set_default_payment_method(uuid) to authenticated;

-- If the method a user just deleted was their default, promote their
-- oldest remaining method to default automatically, so they aren't left
-- with saved methods but no default for no reason they asked for.
create or replace function public.promote_next_default_payment_method()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_default then
    update public.saved_payment_methods
    set is_default = true
    where id = (
      select id from public.saved_payment_methods
      where user_id = old.user_id
      order by created_at asc
      limit 1
    );
  end if;
  return old;
end;
$$;

drop trigger if exists saved_payment_methods_promote_default on public.saved_payment_methods;
create trigger saved_payment_methods_promote_default
  after delete on public.saved_payment_methods
  for each row execute function public.promote_next_default_payment_method();