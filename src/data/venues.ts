/**
 * Backend Phase C: venue discovery, venue detail and slot availability,
 * backed by real Supabase queries against `venues`, `venue_pricing` and
 * `slots`. Shapes are kept close to the old mock module so component code
 * barely changes — the difference is every export here is now async.
 */
import venueBoxCricket from "@/assets/venue-boxcricket.jpg";
import venueBadminton from "@/assets/venue-badminton.jpg";
import venueTennis from "@/assets/venue-tennis.jpg";
import heroTurf from "@/assets/hero-turf.jpg";
import groupFootball from "@/assets/group-football.jpg";
import groupCricket from "@/assets/group-cricket.jpg";
import { supabase } from "@/lib/supabaseClient";

export const amenityList = [
  "Parking",
  "Floodlights",
  "Changing Rooms",
  "Washrooms",
  "Drinking Water",
  "Cafeteria",
  "Equipment Rental",
  "First Aid",
] as const;

export type Amenity = (typeof amenityList)[number];

export type Venue = {
  id: string;
  name: string;
  area: string;
  image: string;
  sports: string[];
  pricePerHour: number;
  distanceKm: number;
  rating: number;
  isOpenNow: boolean;
  latitude: number | null;
  longitude: number | null;
};

export type PriceRow = { sport: string; slotType: string; hours: string; pricePerHour: number };

export type Review = {
  id: string;
  name: string;
  initials: string;
  rating: number;
  date: string;
  text: string;
};

export type VenueDetail = Venue & {
  tagline: string;
  about: string;
  address: string;
  openingHours: string;
  gallery: string[];
  amenities: Amenity[];
  pricing: PriceRow[];
  reviews: Review[];
  reviewCount: number;
};

/** Availability slot as returned by the `slots` table.
 *  Minutes-since-midnight (not just the hour) so venues with a shorter
 *  minimum booking (e.g. 30 min) show each slot distinctly and can be
 *  multi-selected correctly — see startMinutes/endMinutes below. */
export type Slot = {
  id: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
  price: number;
  status: "available" | "booked";
};

const galleryPool = [
  heroTurf,
  venueBoxCricket,
  venueBadminton,
  venueTennis,
  groupCricket,
  groupFootball,
];

/** Deterministic pick from the bundled photo pool, keyed by venue id — used
 *  as a fallback whenever `venues.photos` is empty (no partner-uploaded
 *  photos yet; there's no venue-owner dashboard in this phase). */
function fallbackImage(venueId: string) {
  let seed = 0;
  for (let i = 0; i < venueId.length; i++) seed = venueId.charCodeAt(i) + ((seed << 5) - seed);
  return galleryPool[Math.abs(seed) % galleryPool.length]!;
}

// Kanpur city-centre reference point (Mall Road, Civil Lines) — used only
// to derive a "distance from you" figure until real user geolocation is
// wired up; the app never asks for location permission today.
const CITY_CENTER = { lat: 26.463, lng: 80.352 };

function haversineKm(lat: number, lng: number) {
  const R = 6371;
  const dLat = ((lat - CITY_CENTER.lat) * Math.PI) / 180;
  const dLng = ((lng - CITY_CENTER.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((CITY_CENTER.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOpenNow(hours: { open?: string; close?: string } | null): boolean {
  if (!hours?.open || !hours?.close) return true;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = hours.open.split(":").map(Number);
  const [ch, cm] = hours.close.split(":").map(Number);
  const openMins = (oh ?? 0) * 60 + (om ?? 0);
  // Close times past midnight (e.g. "25:00") are stored as > 24h on purpose.
  const closeMins = (ch ?? 24) * 60 + (cm ?? 0);
  return mins >= openMins && mins <= closeMins;
}

function formatOpeningHours(hours: { open?: string; close?: string } | null): string {
  if (!hours?.open || !hours?.close) return "Hours unavailable";
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const hour24 = (h ?? 0) % 24;
    const suffix = hour24 >= 12 ? "PM" : "AM";
    const display = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return `${display}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
  };
  return `${fmt(hours.open)} – ${fmt(hours.close)} (all days)`;
}

type VenueRow = {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  sports_offered: string[];
  amenities: string[];
  operating_hours: { open?: string; close?: string } | null;
  photos: string[];
  tagline: string | null;
  about: string | null;
  area: string | null;
  rating: number | null;
};

type PricingRow = {
  sport: string;
  price_per_slot: number;
  slot_duration_minutes: number;
  band_label?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

const PRICING_SELECT =
  "*, venue_pricing(sport, price_per_slot, slot_duration_minutes, band_label, start_time, end_time)";

/** Owners price per slot (30/60/90/120 min); the UI says "/hour", so normalise. */
function hourlyPrice(p: Pick<PricingRow, "price_per_slot" | "slot_duration_minutes">) {
  const mins = p.slot_duration_minutes > 0 ? p.slot_duration_minutes : 60;
  return Math.round((p.price_per_slot * 60) / mins);
}

/** "06:00:00" -> "6 AM", "18:30:00" -> "6:30 PM" */
function fmtClock(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hour24 = (h ?? 0) % 24;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const display = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${display}${m ? `:${String(m).padStart(2, "0")}` : ""} ${suffix}`;
}

function rowToVenue(row: VenueRow, pricing: PricingRow[]): Venue {
  const cheapest = pricing.length > 0 ? Math.min(...pricing.map(hourlyPrice)) : 0;
  return {
    id: row.id,
    name: row.name,
    area: row.area ?? row.city,
    image: row.photos?.[0] ?? fallbackImage(row.id),
    sports: row.sports_offered ?? [],
    pricePerHour: cheapest,
    distanceKm:
      row.latitude != null && row.longitude != null
        ? Math.round(haversineKm(row.latitude, row.longitude) * 10) / 10
        : 2.5,
    rating: row.rating ?? 4.5,
    isOpenNow: isOpenNow(row.operating_hours),
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

/** One row per distinct (sport, band, hours, price) — a venue with several
 *  courts of the same sport has identical bands per court, which would
 *  otherwise show up as repeated rows. */
function buildPriceRows(row: VenueRow, pricing: PricingRow[]): PriceRow[] {
  const fallbackHours =
    row.operating_hours?.open && row.operating_hours?.close
      ? `${fmtClock(row.operating_hours.open)} – ${fmtClock(row.operating_hours.close)}`
      : "All day";
  const seen = new Map<string, PriceRow & { sortKey: string }>();
  for (const p of pricing) {
    const hours =
      p.start_time && p.end_time ? `${fmtClock(p.start_time)} – ${fmtClock(p.end_time)}` : fallbackHours;
    const slotType = p.band_label?.trim() || `${p.slot_duration_minutes} min slot`;
    const pricePerHour = hourlyPrice(p);
    const key = `${p.sport}|${slotType}|${hours}|${pricePerHour}`;
    if (!seen.has(key)) {
      seen.set(key, { sport: p.sport, slotType, hours, pricePerHour, sortKey: `${p.sport}|${p.start_time ?? ""}` });
    }
  }
  return [...seen.values()]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ sortKey: _sortKey, ...rest }) => rest);
}

function rowToDetail(row: VenueRow, pricing: PricingRow[]): VenueDetail {
  const venue = rowToVenue(row, pricing);
  const gallery = row.photos?.length
    ? row.photos
    : [fallbackImage(row.id), ...galleryPool.slice(0, 3)];
  return {
    ...venue,
    tagline: row.tagline ?? "",
    about: row.about ?? "",
    address: row.address,
    openingHours: formatOpeningHours(row.operating_hours),
    gallery,
    amenities: (row.amenities ?? []) as Amenity[],
    pricing: buildPriceRows(row, pricing),
    reviews: [],
    reviewCount: 0,
  };
}

export type VenueFilterQuery = {
  query?: string;
  sport?: string;
  area?: string;
  maxPrice?: number;
  maxDistance?: number;
  amenities?: string[];
};

/** Venue discovery — filters run server-side where cheap to (text/sport/area),
 *  price/distance/amenities (derived client-side values) filter after fetch. */
export async function fetchVenues(filters: VenueFilterQuery = {}): Promise<VenueDetail[]> {
  let query = supabase
    .from("venues")
    .select(PRICING_SELECT)
    .eq("is_active", true);

  if (filters.area) query = query.eq("area", filters.area);
  if (filters.query) {
    query = query.or(`name.ilike.%${filters.query}%,area.ilike.%${filters.query}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("fetchVenues failed:", error.message);
    return [];
  }

  let results = (data ?? []).map((row: any) =>
    rowToDetail(row as VenueRow, (row.venue_pricing ?? []) as PricingRow[]),
  );

  if (filters.sport) results = results.filter((v) => v.sports.includes(filters.sport!));
  if (filters.maxPrice != null)
    results = results.filter((v) => v.pricePerHour <= filters.maxPrice!);
  if (filters.maxDistance != null)
    results = results.filter((v) => v.distanceKm <= filters.maxDistance!);
  if (filters.amenities?.length) {
    results = results.filter((v) =>
      filters.amenities!.every((a) => v.amenities.includes(a as Amenity)),
    );
  }

  return results;
}

/** Live number of active venues per sport (keyed by sport display name,
 *  e.g. "Box Cricket"), tallied from `venues.sports_offered`. Used by the
 *  landing page's "Sports You Love" cards. Returns {} on error so the UI can
 *  hide the count rather than show a wrong one. */
export async function fetchSportVenueCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("venues").select("sports_offered").eq("is_active", true);
  if (error) {
    console.error("fetchSportVenueCounts failed:", error.message);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    // A venue counts once per sport even if the sport is listed twice.
    const unique = new Set(((row as { sports_offered: string[] | null }).sports_offered ?? []).map((n) => n.trim()));
    for (const name of unique) counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
}

export async function fetchVenue(id: string): Promise<VenueDetail | undefined> {
  const { data, error } = await supabase
    .from("venues")
    .select(PRICING_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("fetchVenue failed:", error.message);
    return undefined;
  }
  if (!data) return undefined;

  return rowToDetail(data as VenueRow, ((data as any).venue_pricing ?? []) as PricingRow[]);
}

/** "06:30:00" -> 390 */
function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Real availability for one venue/date/sport, straight from `slots`. */
export async function fetchSlots(venueId: string, dateISO: string, sport: string): Promise<Slot[]> {
  const { data, error } = await supabase
    .from("slots")
    .select("id, start_time, end_time, price, status")
    .eq("venue_id", venueId)
    .eq("sport", sport)
    .eq("date", dateISO)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("fetchSlots failed:", error.message);
    return [];
  }

  // A venue can have several courts for one sport, each with its own row for
  // the same start time. Show ONE chip per start time: bookable if any court
  // is free (using that court's slot id and price), booked only if all are.
  const byStart = new Map<string, NonNullable<typeof data>[number]>();
  for (const row of data ?? []) {
    const current = byStart.get(row.start_time);
    if (!current || (current.status !== "available" && row.status === "available")) {
      byStart.set(row.start_time, row);
    }
  }

  return [...byStart.values()]
    .map((row) => {
      const startMinutes = toMinutes(row.start_time);
      let endMinutes = toMinutes(row.end_time);
      // A slot generated across midnight (e.g. 23:30-00:00) has a smaller
      // raw end-of-day time than its start; treat it as next-day minutes so
      // duration/contiguity math (endMinutes - startMinutes) stays positive.
      if (endMinutes <= startMinutes) endMinutes += 24 * 60;
      return {
        id: row.id,
        label: formatSlotTime(startMinutes),
        startMinutes,
        endMinutes,
        price: row.price ?? 0,
        status: row.status === "available" ? "available" : "booked",
      } as Slot;
    })
    .sort((a, b) => a.startMinutes - b.startMinutes);
}

/** Whole-hour label, e.g. "6 AM" slots elsewhere in the app (hosted games,
 *  which are always hour blocks regardless of a venue's slot duration). */
export function formatHour(h: number) {
  const hour = h % 24;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

/** Minute-precise label for a real booking slot, e.g. "6:00 AM" / "6:30 AM". */
export function formatSlotTime(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(m / 60);
  const min = m % 60;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return min === 0 ? `${display}:00 ${suffix}` : `${display}:${String(min).padStart(2, "0")} ${suffix}`;
}