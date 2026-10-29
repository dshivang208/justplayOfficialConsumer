import { supabase } from "./supabaseClient";

/**
 * Logs a QR scan and resolves where it should go.
 *  - no code  -> level 1 (website QR): returns null
 *  - code     -> level 2 (venue QR): returns the venue id, or null if the code
 *                is unknown / the venue isn't live (caller falls back to /venues)
 * Never throws — a QR scan must always land somewhere useful.
 */
export async function recordQrScan(code?: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("record_qr_scan", { p_code: code ?? null });
    if (error) return null;
    return (data as string | null) ?? null;
  } catch {
    return null;
  }
}
