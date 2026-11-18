-- Site settings: support contact, announcement bar and maintenance notice for the consumer app.
create table if not exists public.site_settings (
  id                    boolean primary key default true check (id),   -- single row
  support_email         text,
  support_phone         text,
  announcement_active   boolean not null default false,
  announcement_text     text,
  announcement_url      text,
  maintenance_mode      boolean not null default false,
  maintenance_message   text,
  updated_at            timestamptz not null default now(),
  updated_by            uuid references public.admin_users (id) on delete set null
);
insert into public.site_settings (id, support_email) values (true, 'support@justplay.in')
  on conflict (id) do nothing;

alter table public.site_settings enable row level security;
drop policy if exists "site_settings public read" on public.site_settings;
create policy "site_settings public read" on public.site_settings for select using (true);
grant select on public.site_settings to anon, authenticated;
-- No write policy: only admin_update_site_settings below.

create or replace function public.admin_update_site_settings(
  p_support_email text, p_support_phone text,
  p_announcement_active boolean, p_announcement_text text, p_announcement_url text,
  p_maintenance_mode boolean, p_maintenance_message text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  if coalesce(p_announcement_active, false) and length(btrim(coalesce(p_announcement_text,''))) < 3 then
    raise exception 'ANNOUNCEMENT_TEXT_REQUIRED';
  end if;
  if p_announcement_url is not null and btrim(p_announcement_url) <> ''
     and p_announcement_url !~* '^(https://|/)' then
    raise exception 'INVALID_URL';
  end if;
  update public.site_settings set
    support_email = nullif(btrim(coalesce(p_support_email,'')), ''),
    support_phone = nullif(btrim(coalesce(p_support_phone,'')), ''),
    announcement_active = coalesce(p_announcement_active, false),
    announcement_text = nullif(btrim(coalesce(p_announcement_text,'')), ''),
    announcement_url = nullif(btrim(coalesce(p_announcement_url,'')), ''),
    maintenance_mode = coalesce(p_maintenance_mode, false),
    maintenance_message = nullif(btrim(coalesce(p_maintenance_message,'')), ''),
    updated_at = now(), updated_by = auth.uid()
  where id = true;
  insert into public.admin_audit_log (admin_id, action, target_table, target_id, details)
  values (auth.uid(), 'site_settings.update', 'site_settings', 'singleton',
          jsonb_build_object('announcement_active', p_announcement_active, 'maintenance_mode', p_maintenance_mode));
end $$;
grant execute on function public.admin_update_site_settings(text,text,boolean,text,text,boolean,text) to authenticated;

do $$ begin alter publication supabase_realtime add table public.site_settings;
exception when others then null; end $$;
