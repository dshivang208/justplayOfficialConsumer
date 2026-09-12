-- Groups fix, part 2: realistic seed data to replace the hardcoded demo
-- cards that used to live in src/data/landing.ts.
--
-- public.groups.created_by was NOT NULL with a hard FK to public.users.
-- Seeding "platform" sample groups needs a way to exist with no personal
-- owner — inserting a fake row into public.users (and, transitively,
-- auth.users) just to satisfy that FK would be fragile and is exactly the
-- kind of ad-hoc pierce-the-auth-system change to avoid. Relaxing the
-- column to nullable is the standard, safe way to represent "owned by the
-- platform, not a specific player": NULL always satisfies a foreign key,
-- so a real user id is never required.
--
-- isMine (in src/lib/community.tsx) is `created_by === current user id`,
-- which is simply false for everyone when created_by is null — these seed
-- groups are joinable like any other, just not "manageable" by any one
-- account, which is exactly what platform-seeded sample content should do.
alter table public.groups alter column created_by drop not null;

-- cover_photo_url is left null on purpose — there's no group-owner image
-- upload flow yet, so the frontend (fallbackGroupImage in
-- src/data/community.ts) picks a deterministic bundled placeholder cover
-- based on the group's sport, the same pattern already used for venues
-- with no partner-uploaded photos.
--
-- member_count here is a realistic *seed* number for display only. It is
-- NOT backed by matching public.group_members rows (those need real
-- auth.users accounts, which a migration can't fabricate safely). The
-- existing join_group/leave_group RPCs recompute member_count from actual
-- group_members rows on every join/leave — so the first real join or leave
-- on one of these seed groups will reset its count to reflect real members
-- from that point on. That's expected, correct behaviour, not a bug: a
-- seed number is a launch-day placeholder, not a promise.
insert into public.groups (id, name, sport, description, area, privacy, created_by, member_count)
values
  ('22222222-2222-2222-2222-222222222201', 'Kanpur Football Circle', 'Football',
    'A weekly 6-a-side crew that plays every Sunday evening. All skill levels welcome — we rotate turfs around the city.',
    'Kakadeo', 'public', null, 128),
  ('22222222-2222-2222-2222-222222222202', 'Green Park Cricket Club', 'Cricket',
    'Box cricket regulars near Green Park. Weeknight matches after 7 PM, weekend tournaments once a month.',
    'Civil Lines', 'public', null, 94),
  ('22222222-2222-2222-2222-222222222203', 'Weekend Badminton Warriors', 'Badminton',
    'Saturday and Sunday morning badminton at Swaroop Nagar. Doubles-focused, beginner-friendly coaching on the first Saturday of the month.',
    'Swaroop Nagar', 'public', null, 76),
  ('22222222-2222-2222-2222-222222222204', 'Turf Titans FC', 'Football',
    'Competitive 7-a-side football club with a standing Kalyanpur turf slot every Friday night. Trials open for new strikers and defenders.',
    'Kalyanpur', 'public', null, 61),
  ('22222222-2222-2222-2222-222222222205', 'Kanpur Tennis Society', 'Tennis',
    'Clay-court tennis group at Ganga Sports Club. Singles ladder plus casual doubles on weekend mornings.',
    'Civil Lines', 'private', null, 39),
  ('22222222-2222-2222-2222-222222222206', 'Panki Hoopers Basketball', 'Basketball',
    'Indoor basketball pickup games at Panki Play Factory. Tuesday and Thursday evenings, 5-on-5 full-court.',
    'Panki', 'public', null, 45),
  ('22222222-2222-2222-2222-222222222207', 'Barra Box Cricket League', 'Box Cricket',
    'Casual box cricket every alternate weekend near Barra. New players always welcome — bring your own bat or borrow one at the venue.',
    'Barra', 'public', null, 58),
  ('22222222-2222-2222-2222-222222222208', 'Kalyanpur Pickleball Club', 'Pickleball',
    'Kanpur''s newest pickleball crew, playing Sunday mornings. Equipment provided for first-timers.',
    'Kalyanpur', 'public', null, 22)
on conflict (id) do nothing;