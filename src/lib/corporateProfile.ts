/**
 * Corporate profile — the player's registered business details, used by
 * venues to issue GST invoices. Reads hit the table directly (RLS: own row
 * only); writes go through RPCs from 20261023060000_corporate_profile.sql.
 */
import { supabase } from "./supabaseClient";

export type CorporateProfile = {
  gstNumber: string;
  companyName: string;
  companyAddress: string;
  updatedAt: string;
};

type Row = {
  gst_number: string;
  company_name: string;
  company_address: string;
  updated_at: string;
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Returns an error message, or null when the GSTIN looks valid
 *  (format + the official mod-36 check character). */
export function gstinError(raw: string): string | null {
  const g = raw.trim().toUpperCase();
  if (!g) return "Enter your GST number.";
  if (g.length !== 15) return "A GST number has 15 characters.";
  if (!GSTIN_RE.test(g)) return "This doesn't look like a valid GST number.";
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(g[i]!) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  const check = CHARS[(36 - (sum % 36)) % 36];
  return check === g[14] ? null : "This GST number's check digit is wrong — please re-check it.";
}

export async function fetchCorporateProfile(): Promise<CorporateProfile | null> {
  const { data, error } = await supabase
    .from("corporate_profiles")
    .select("gst_number, company_name, company_address, updated_at")
    .maybeSingle<Row>();
  if (error) {
    console.error("fetchCorporateProfile failed:", error.message);
    return null;
  }
  return data
    ? {
        gstNumber: data.gst_number,
        companyName: data.company_name,
        companyAddress: data.company_address,
        updatedAt: data.updated_at,
      }
    : null;
}

const NOT_READY = "Corporate profile isn't available yet. Please try again later.";

function friendly(message: string): Error {
  if (/could not find the function|schema cache|does not exist/i.test(message)) return new Error(NOT_READY);
  if (message.includes("INVALID_GST")) return new Error("Enter a valid 15-character GST number.");
  if (message.includes("NAME_REQUIRED")) return new Error("Enter the registered company name.");
  if (message.includes("ADDRESS_REQUIRED")) return new Error("Enter the registered company address.");
  if (message.includes("AUTH_REQUIRED")) return new Error("Please sign in again.");
  return new Error("Couldn't save your corporate profile. Try again.");
}

export async function saveCorporateProfile(input: {
  gstNumber: string;
  companyName: string;
  companyAddress: string;
}): Promise<void> {
  const { error } = await supabase.rpc("save_corporate_profile", {
    p_gst_number: input.gstNumber,
    p_company_name: input.companyName,
    p_company_address: input.companyAddress,
  });
  if (error) throw friendly(error.message);
}

export async function deleteCorporateProfile(): Promise<void> {
  const { error } = await supabase.rpc("delete_corporate_profile");
  if (error) throw friendly(error.message);
}

// ── GST invoice details on a booking ──────────────────────────────────────
// The profile is COPIED onto the booking (server-side), so the venue sees the
// details that were current when the invoice was requested.

export async function attachBookingInvoice(bookingId: string): Promise<void> {
  const { error } = await supabase.rpc("attach_booking_invoice", { p_booking_id: bookingId });
  if (!error) return;
  if (error.message.includes("NO_CORPORATE_PROFILE"))
    throw new Error("Add your corporate profile first.");
  if (error.message.includes("BOOKING_CANCELLED"))
    throw new Error("This booking is cancelled.");
  if (/could not find the function|schema cache|does not exist/i.test(error.message))
    throw new Error("GST invoices aren't available yet. Please try again later.");
  throw new Error("Couldn't add GST details to this booking. Try again.");
}

export async function removeBookingInvoice(bookingId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_booking_invoice", { p_booking_id: bookingId });
  if (error) throw new Error("Couldn't remove the GST details. Try again.");
}

/** Ids of the player's bookings that already carry GST invoice details.
 *  Tolerant of the table not existing yet (returns an empty set). */
export async function fetchInvoiceBookingIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from("booking_invoice_details").select("booking_id");
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.booking_id as string));
}
