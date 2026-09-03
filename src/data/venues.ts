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

/** Availability slot as returned by the `slots` table. */
export type Slot = {
  id: string;
  label: string;
  startHour: number;
  price: number;
  status: "available" | "booked";
};

const galleryPool = [heroTurf, venueBoxCricket, venueBadminton, venueTennis, groupCricket, groupFootball];

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
    Math.cos((CITY_CENTER.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
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

type PricingRow = { sport: string; price_per_slot: number; slot_duration_minutes: number };

function rowToVenue(row: VenueRow, pricing: PricingRow[]): Venue {
  const cheapest = pricing.length > 0 ? Math.min(...pricing.map((p) => p.price_per_slot)) : 0;
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
  };
}

function rowToDetail(row: VenueRow, pricing: PricingRow[]): VenueDetail {
  const venue = rowToVenue(row, pricing);
  const gallery = row.photos?.length ? row.photos : [fallbackImage(row.id), ...galleryPool.slice(0, 3)];
  return {
    ...venue,
    tagline: row.tagline ?? "",
    about: row.about ?? "",
    address: row.address,
    openingHours: formatOpeningHours(row.operating_hours),
    gallery,
    amenities: (row.amenities ?? []) as Amenity[],
    pricing: pricing.map((p) => ({
      sport: p.sport,
      slotType: `${p.slot_duration_minutes} min slot`,
      hours: "6 AM – 11 PM",
      pricePerHour: p.price_per_slot,
    })),
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
    .select("*, venue_pricing(sport, price_per_slot, slot_duration_minutes)")
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
  if (filters.maxPrice != null) results = results.filter((v) => v.pricePerHour <= filters.maxPrice!);
  if (filters.maxDistance != null) results = results.filter((v) => v.distanceKm <= filters.maxDistance!);
  if (filters.amenities?.length) {
    results = results.filter((v) => filters.amenities!.every((a) => v.amenities.includes(a as Amenity)));
  }

  return results;
}

export async function fetchVenue(id: string): Promise<VenueDetail | undefined> {
  const { data, error } = await supabase
    .from("venues")
    .select("*, venue_pricing(sport, price_per_slot, slot_duration_minutes)")
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

/** Real availability for one venue/date/sport, straight from `slots`. */
export async function fetchSlots(venueId: string, dateISO: string, sport: string): Promise<Slot[]> {
  const { data, error } = await supabase
    .from("slots")
    .select("id, start_time, price, status")
    .eq("venue_id", venueId)
    .eq("sport", sport)
    .eq("date", dateISO)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("fetchSlots failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const startHour = Number(row.start_time.slice(0, 2));
    return {
      id: row.id,
      label: formatHour(startHour),
      startHour,
      price: row.price ?? 0,
      status: row.status === "available" ? "available" : "booked",
    } as Slot;
  });
}

export function formatHour(h: number) {
  const hour = h % 24;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}