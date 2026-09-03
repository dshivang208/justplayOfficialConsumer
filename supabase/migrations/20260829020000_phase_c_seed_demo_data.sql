-- ============================================================================
-- JustPlay — demo seed data for Phase C/E real-data pages
-- ============================================================================
-- Venues, pricing and a rolling 14-day slot calendar, so venue discovery /
-- detail / booking work against real rows instead of an empty table. Also
-- seeds `events` (no user FK, safe to seed). `hosted_games` and `groups`
-- are intentionally left empty here — they require a real host_user_id /
-- created_by referencing auth.users, which only exists once real people
-- sign in; the Host a Game / Create Group flows populate them from there.
--
-- Safe to re-run: venues are upserted by a fixed id, slots use
-- ON CONFLICT DO NOTHING against the (venue_id, sport, date, start_time)
-- uniqueness constraint from Phase A.
-- ============================================================================

insert into public.venues (id, name, address, city, latitude, longitude, sports_offered, amenities, operating_hours, photos, tagline, about, area, rating)
values
  ('11111111-1111-1111-1111-111111111101', 'Greenfield Box Arena', 'Plot 14, Vikas Nagar Road, Kakadeo, Kanpur 208025', 'Kanpur', 26.4780, 80.3319,
    '["Box Cricket","Football"]', '["Parking","Floodlights","Changing Rooms","Washrooms","Drinking Water","Cafeteria"]',
    '{"open":"06:00","close":"24:00"}', '{}',
    'Kanpur''s busiest floodlit box cricket cage',
    'Greenfield Box Arena is a verified JustPlay partner in Kakadeo, Kanpur. Slots are confirmed instantly — turn up, scan the QR at the gate and play.',
    'Kakadeo', 4.6),
  ('11111111-1111-1111-1111-111111111102', 'Smash Point Badminton', 'Near Rave Moti, Swaroop Nagar, Kanpur 208002', 'Kanpur', 26.4925, 80.3273,
    '["Badminton","Table Tennis"]', '["Parking","Changing Rooms","Washrooms","Drinking Water","Equipment Rental","First Aid"]',
    '{"open":"05:30","close":"23:00"}', '{}',
    'Six wooden courts, air-cooled, tournament grade',
    'Smash Point Badminton is a verified JustPlay partner in Swaroop Nagar, Kanpur. Six wooden courts, air-cooled, tournament grade. Slots are confirmed instantly.',
    'Swaroop Nagar', 4.8),
  ('11111111-1111-1111-1111-111111111103', 'Ganga Sports Club', 'Mall Road, Civil Lines, Kanpur 208001', 'Kanpur', 26.4630, 80.3520,
    '["Tennis","Pickleball"]', '["Parking","Floodlights","Changing Rooms","Cafeteria","First Aid"]',
    '{"open":"06:00","close":"22:00"}', '{}',
    'Heritage clay courts in the heart of Civil Lines',
    'Ganga Sports Club is a verified JustPlay partner in Civil Lines, Kanpur. Heritage clay courts in the heart of Civil Lines. Slots are confirmed instantly.',
    'Civil Lines', 4.4),
  ('11111111-1111-1111-1111-111111111104', 'Turf 11 Kalyanpur', 'Kalyanpur Bypass, Kalyanpur, Kanpur 208017', 'Kanpur', 26.5010, 80.2790,
    '["Football","Box Cricket"]', '["Parking","Floodlights","Changing Rooms","Washrooms","Cafeteria","Equipment Rental"]',
    '{"open":"06:00","close":"25:00"}', '{}',
    'FIFA-spec 5s & 7s turf with night play',
    'Turf 11 Kalyanpur is a verified JustPlay partner in Kalyanpur, Kanpur. FIFA-spec 5s & 7s turf with night play. Slots are confirmed instantly.',
    'Kalyanpur', 4.7),
  ('11111111-1111-1111-1111-111111111105', 'Panki Play Factory', 'Panki Industrial Area Site 1, Panki, Kanpur 208020', 'Kanpur', 26.4570, 80.2450,
    '["Badminton","Basketball"]', '["Parking","Washrooms","Drinking Water","Equipment Rental"]',
    '{"open":"06:00","close":"23:00"}', '{}',
    'Indoor multi-sport factory floor turned playground',
    'Panki Play Factory is a verified JustPlay partner in Panki, Kanpur. Indoor multi-sport factory floor turned playground. Slots are confirmed instantly.',
    'Panki', 4.2),
  ('11111111-1111-1111-1111-111111111106', 'Barra Court Complex', 'Barra 2, Vishwa Bank Road, Barra, Kanpur 208027', 'Kanpur', 26.4180, 80.3030,
    '["Pickleball","Tennis"]', '["Parking","Floodlights","Washrooms","Drinking Water","First Aid"]',
    '{"open":"06:00","close":"22:30"}', '{}',
    'Kanpur''s first dedicated pickleball complex',
    'Barra Court Complex is a verified JustPlay partner in Barra, Kanpur. Kanpur''s first dedicated pickleball complex. Slots are confirmed instantly.',
    'Barra', 4.5)
on conflict (id) do update set
  name = excluded.name, address = excluded.address, sports_offered = excluded.sports_offered,
  amenities = excluded.amenities, operating_hours = excluded.operating_hours,
  tagline = excluded.tagline, about = excluded.about, area = excluded.area, rating = excluded.rating;

insert into public.venue_pricing (venue_id, sport, price_per_slot, slot_duration_minutes)
values
  ('11111111-1111-1111-1111-111111111101', 'Box Cricket', 900, 60),
  ('11111111-1111-1111-1111-111111111101', 'Football', 900, 60),
  ('11111111-1111-1111-1111-111111111102', 'Badminton', 450, 60),
  ('11111111-1111-1111-1111-111111111102', 'Table Tennis', 300, 60),
  ('11111111-1111-1111-1111-111111111103', 'Tennis', 700, 60),
  ('11111111-1111-1111-1111-111111111103', 'Pickleball', 500, 60),
  ('11111111-1111-1111-1111-111111111104', 'Football', 1100, 60),
  ('11111111-1111-1111-1111-111111111104', 'Box Cricket', 1000, 60),
  ('11111111-1111-1111-1111-111111111105', 'Badminton', 500, 60),
  ('11111111-1111-1111-1111-111111111105', 'Basketball', 550, 60),
  ('11111111-1111-1111-1111-111111111106', 'Pickleball', 600, 60),
  ('11111111-1111-1111-1111-111111111106', 'Tennis', 650, 60)
on conflict do nothing;

-- Rolling 14-day, 6am–11pm hourly slot calendar for every venue/sport pair,
-- priced by time-of-day band the same way the old mock generator did
-- (mornings cheaper, evenings at full price).
insert into public.slots (venue_id, sport, date, start_time, end_time, status, price)
select
  vp.venue_id,
  vp.sport,
  d::date as date,
  (h || ':00')::time as start_time,
  ((h + 1) || ':00')::time as end_time,
  'available' as status,
  case
    when h < 12 then round(vp.price_per_slot * 0.8)
    when h < 17 then round(vp.price_per_slot * 0.9)
    else vp.price_per_slot
  end as price
from public.venue_pricing vp
cross join generate_series(current_date, current_date + interval '13 days', interval '1 day') as d
cross join generate_series(6, 22) as h
on conflict (venue_id, sport, date, start_time) do nothing;

-- A handful of already-booked slots so the SlotGrid legend/UI has both
-- states to show on day 1 (mirrors the old mock's ~30% booked ratio).
update public.slots
set status = 'booked'
where date = current_date
  and status = 'available'
  and extract(hour from start_time)::int in (18, 19, 20)
  and abs(hashtext(id::text)) % 3 = 0;

-- ============================================================================
-- Events (no user FK — safe to seed directly)
-- ============================================================================

insert into public.events (id, title, description, date, venue_id, sport, entry_fee, fee_unit, participant_limit, participant_count, organizer_info, kind, time_label, cta_type)
values
  ('22222222-2222-2222-2222-222222222201', 'Kanpur Premier Box League',
    'A city-wide 6-a-side box cricket league. Group stage followed by knockouts. Tennis ball, floodlit evening matches.',
    current_date + interval '14 days', '11111111-1111-1111-1111-111111111101', 'Box Cricket', 2400, 'per team', 32, 26,
    '{"name":"JustPlay Kanpur","about":"Official JustPlay-organized city league."}', 'Tournament', '6:00 PM onwards', 'register'),
  ('22222222-2222-2222-2222-222222222202', 'Monsoon 5-a-side Cup',
    'Weekend knockout football tournament on FIFA-spec turf. Open to all skill levels, 7 players per squad.',
    current_date + interval '22 days', '11111111-1111-1111-1111-111111111104', 'Football', 1800, 'per team', 16, 13,
    '{"name":"Turf 11 Kalyanpur","about":"Hosted by the venue in partnership with JustPlay."}', 'Tournament', '7:00 AM onwards', 'register'),
  ('22222222-2222-2222-2222-222222222203', 'Beginner Badminton Camp',
    'Weekly Saturday coaching camp for beginners — footwork, serves and doubles strategy with a certified coach.',
    current_date + interval '6 days', '11111111-1111-1111-1111-111111111102', 'Badminton', 999, 'per month', 20, 9,
    '{"name":"Coach Anita Rawat","about":"Ex-state level player, 8 years coaching experience."}', 'Coaching Camp', '8:00 AM onwards', 'register'),
  ('22222222-2222-2222-2222-222222222204', 'Pickleball Open Doubles',
    'Casual open-doubles meetup — mixed skill levels welcome, rotating partners every 15 minutes.',
    current_date + interval '29 days', '11111111-1111-1111-1111-111111111106', 'Pickleball', 600, 'per pair', 24, 16,
    '{"name":"Barra Pickleball Collective","about":"Community-run weekly meetup group."}', 'Meetup', '5:00 PM onwards', 'interest')
on conflict (id) do update set
  title = excluded.title, description = excluded.description, date = excluded.date,
  entry_fee = excluded.entry_fee, fee_unit = excluded.fee_unit, participant_limit = excluded.participant_limit;

-- ============================================================================
-- End of seed data
-- ============================================================================