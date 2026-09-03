import type { Slot } from "@/data/venues";

export const PLATFORM_FEE_RATE = 0.05;

export type PriceBreakdown = {
  slotCount: number;
  basePrice: number;
  platformFee: number;
  gst: number;
  total: number;
};

export function calculatePrice(slots: Slot[]): PriceBreakdown {
  const basePrice = slots.reduce((sum, s) => sum + s.price, 0);
  const platformFee = Math.round(basePrice * PLATFORM_FEE_RATE);
  const gst = Math.round((basePrice + platformFee) * 0.18);
  return {
    slotCount: slots.length,
    basePrice,
    platformFee,
    gst,
    total: basePrice + platformFee + gst,
  };
}

export function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** Slots must be contiguous hours to form one booking window. */
export function isContiguous(slots: Slot[]) {
  const hours = slots.map((s) => s.startHour).sort((a, b) => a - b);
  return hours.every((h, i) => i === 0 || h === hours[i - 1]! + 1);
}

export function slotRangeLabel(slots: Slot[], formatHour: (h: number) => string) {
  if (slots.length === 0) return "";
  const sorted = [...slots].sort((a, b) => a.startHour - b.startHour);
  return `${formatHour(sorted[0]!.startHour)} – ${formatHour(sorted[sorted.length - 1]!.startHour + 1)}`;
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