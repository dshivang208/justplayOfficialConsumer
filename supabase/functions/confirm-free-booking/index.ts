// JustPlay — Backend Phase D/F: confirm-free-booking
//
// Covers the one payment path that never touches Razorpay at all: wallet
// credit covers the full amount. Still goes through a server-side check
// (never trust the client's claim that nothing is owed) and the same
// `mark_booking_confirmed` RPC everything else uses, so the referral-reward
// hook (Phase F) fires consistently regardless of payment method.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errorResponse("Missing Authorization header", 401);

  let bookingId: string | undefined;
  try {
    ({ booking_id: bookingId } = await req.json());
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (!bookingId) return errorResponse("booking_id is required", 400);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: booking } = await userClient
    .from("bookings")
    .select("id, status, price_paid, credit_applied")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return errorResponse("Booking not found", 404);
  if (booking.status !== "pending") return errorResponse(`Booking is '${booking.status}'`, 409);
  if (booking.price_paid - booking.credit_applied > 0) {
    return errorResponse("This booking still has an amount payable — use Razorpay checkout instead", 400);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  await adminClient.from("payment_events").insert({
    booking_id: bookingId,
    source: "client_verify",
    razorpay_event: "fully_covered_by_wallet_credit",
    payload: {},
  });

  const { data: confirmed, error } = await adminClient.rpc("mark_booking_confirmed", {
    p_booking_id: bookingId,
    p_payment_id: null,
  });

  if (error) return errorResponse(error.message, 500);
  return json({ confirmed: true, booking: confirmed });
});