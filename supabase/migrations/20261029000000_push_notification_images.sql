-- ============================================================================
-- JustPlay — images in admin push notifications
--   * public bucket `notification-images` (anyone can VIEW — the browser/OS
--     fetches the picture itself; only admins can upload/delete)
--   * notifications_log.image_url remembers what was sent
-- Needs is_admin() from the admin migrations. Safe to re-run.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notification-images', 'notification-images', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "notification images public read" on storage.objects;
create policy "notification images public read" on storage.objects
  for select using (bucket_id = 'notification-images');

drop policy if exists "notification images admin upload" on storage.objects;
create policy "notification images admin upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'notification-images' and public.is_admin());

drop policy if exists "notification images admin delete" on storage.objects;
create policy "notification images admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'notification-images' and public.is_admin());

alter table public.notifications_log add column if not exists image_url text;
