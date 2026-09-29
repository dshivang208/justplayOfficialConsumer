import type { Slot } from "@/data/venues";

export const PLATFORM_FEE_RATE = 0.05;

export type PriceBreakdown = {
  slotCount: number;
  /** Total booked duration in minutes — NOT slotCount * 60. A venue can set
   *  a shorter minimum booking (e.g. 30 min), so this is the real sum of
   *  each selected slot's own duration. */
  durationMinutes: number;
  basePrice: number;
  platformFee: number;
  gst: number;
  total: number;
};

export function calculatePrice(slots: Slot[]): PriceBreakdown {
  const basePrice = slots.reduce((sum, s) => sum + s.price, 0);
  const durationMinutes = slots.reduce((sum, s) => sum + (s.endMinutes - s.startMinutes), 0);
  const platformFee = Math.round(basePrice * PLATFORM_FEE_RATE);
  const gst = Math.round((basePrice + platformFee) * 0.18);
  return {
    slotCount: slots.length,
    durationMinutes,
    basePrice,
    platformFee,
    gst,
    total: basePrice + platformFee + gst,
  };
}

/** "90" -> "1 hr 30 min"; "60" -> "1 hr"; "30" -> "30 min". */
export function formatDuration(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

export function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** Slots must be back-to-back (this one's end === the next one's start) to
 *  form a single booking window — duration-aware, so it works whether the
 *  venue's minimum booking is 30, 60, or 90 minutes. */
export function isContiguous(slots: Slot[]) {
  const sorted = [...slots].sort((a, b) => a.startMinutes - b.startMinutes);
  return sorted.every((s, i) => i === 0 || s.startMinutes === sorted[i - 1]!.endMinutes);
}

export function slotRangeLabel(slots: Slot[], formatSlotTime: (minutes: number) => string) {
  if (slots.length === 0) return "";
  const sorted = [...slots].sort((a, b) => a.startMinutes - b.startMinutes);
  return `${formatSlotTime(sorted[0]!.startMinutes)} – ${formatSlotTime(sorted[sorted.length - 1]!.endMinutes)}`;
}

/** Next N days starting today, for the date picker. */
export function upcomingDays(count = 14, from = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return {
      iso: d.toISOString().slice(0, 10),
      weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
      day: d.getDate(),
      month: d.toLocaleDateString("en-IN", { month: "short" }),
      isToday: i === 0,
    };
  });
}

export function formatDateLong(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Short, human-friendly display id derived from a real booking UUID. */
export function displayBookingId(uuid: string) {
  return `JP${uuid.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}