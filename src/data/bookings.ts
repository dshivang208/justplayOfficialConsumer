/**
 * Backend Phase C: My Bookings, backed by the real `bookings` table (RLS
 * already scopes every query to the signed-in user — see Phase A).
 * `startHour`/`hours` are recovered from the `time` display label the
 * `create_booking` RPC stored, so this stays a pure client-side mapper with
 * no extra joins needed for the common case.
 */
import { supabase } from "@/lib/supabaseClient";
import { formatHour } from "./venues";

export type BookingStatus = "confirmed" | "pending" | "cancelled" | "cancelled_refunded" | "completed";

export type Booking = {
  id: string;
  venueId: string;
  venueName: string;
  venueImage: string;
  area: string;
  sport: string;
  /** ISO date, yyyy-mm-dd */
  date: string;
  startHour: number;
  hours: number;
  status: BookingStatus;
  amountPaid: number;
};

export const CANCELLATION_WINDOW_HOURS = 2;

type BookingRow = {
  id: string;
  venue_id: string;
  sport: string;
  date: string;
  time: string;
  price_paid: number;
  credit_applied: number;
  status: BookingStatus;
  venues: { name: string; area: string | null; photos: string[] } | null;
};

function parseHourFromLabel(time: string): { startHour: number; hours: number } {
  // "6:00 PM – 7:00 PM" -> startHour 18, hours 1
  const [startPart, endPart] = time.split("–").map((s) => s.trim());
  const parse = (label?: string) => {
    if (!label) return null;
    const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label);
    if (!match) return null;
    let h = Number(match[1]) % 12;
    if (match[3]!.toUpperCase() === "PM") h += 12;
    return h;
  };
  const start = parse(startPart) ?? 0;
  const end = parse(endPart);
  return { startHour: start, hours: end != null ? Math.max(1, end - start) : 1 };
}

function rowToBooking(row: BookingRow): Booking {
  const { startHour, hours } = parseHourFromLabel(row.time);
  return {
    id: row.id,
    venueId: row.venue_id,
    venueName: row.venues?.name ?? "Venue",
    venueImage: row.venues?.photos?.[0] ?? "",
    area: row.venues?.area ?? "",
    sport: row.sport,
    date: row.date,
    startHour,
    hours,
    status: row.status,
    amountPaid: row.status.startsWith("cancelled") ? 0 : row.price_paid - row.credit_applied,
  };
}

export async function fetchMyBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, venue_id, sport, date, time, price_paid, credit_applied, status, venues(name, area, photos)")
    .order("date", { ascending: false });

  if (error) {
    console.error("fetchMyBookings failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => rowToBooking(row as unknown as BookingRow));
}

/** Cancels a booking (and triggers a Razorpay refund when eligible) via the
 *  Phase D Edge Function, which wraps the Phase C `cancel_booking` RPC. */
export async function cancelBooking(bookingId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{
    refunded: boolean;
    refundError?: string;
  }>("cancel-booking-refund", { body: { booking_id: bookingId } });

  if (error) throw new Error(error.message || "Could not cancel this booking.");
  if (data?.refundError) throw new Error(data.refundError);
}

export function bookingStart(b: Booking) {
  const d = new Date(`${b.date}T00:00:00`);
  d.setHours(b.startHour, 0, 0, 0);
  return d;
}

export function isUpcoming(b: Booking, now = new Date()) {
  return bookingStart(b).getTime() > now.getTime() && !b.status.startsWith("cancelled");
}

/** Free cancellation until CANCELLATION_WINDOW_HOURS before the slot. */
export function refundEligible(b: Booking, now = new Date()) {
  const msLeft = bookingStart(b).getTime() - now.getTime();
  return msLeft > CANCELLATION_WINDOW_HOURS * 60 * 60 * 1000;
}

export function hoursUntil(b: Booking, now = new Date()) {
  return (bookingStart(b).getTime() - now.getTime()) / 3_600_000;
}

export function timeRangeLabel(b: Booking) {
  return `${formatHour(b.startHour)} – ${formatHour(b.startHour + b.hours)}`;
}