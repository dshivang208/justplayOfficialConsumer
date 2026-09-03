// JustPlay — Backend Phase D: cancel-booking-refund
//
// Wraps Phase C's `cancel_booking` RPC (which does the atomic "cancel +
// release slot(s)" step) and, when the RPC reports the booking is inside
// the free-cancellation window AND was actually paid for via Razorpay,
// calls the Razorpay Refunds API and logs the result to `refund_log` via
// `mark_booking_refunded` — the admin-visible trail called out in the brief,
// even though there's no admin UI yet.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errorResponse("Missing Authorization header", 401);

  let bookingId: string | undefined;
  let reason: string | undefined;
  try {
    const body = await req.json();
    bookingId = body.booking_id;
    reason = body.reason;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (!bookingId) return errorResponse("booking_id is required", 400);

  // Runs as the calling user — cancel_booking() itself checks ownership
  // again internally, this is belt-and-suspenders.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: rows, error: cancelError } = await userClient.rpc("cancel_booking", {
    p_booking_id: bookingId,
    p_reason: reason ?? null,
  });

  if (cancelError) return errorResponse(cancelError.message, 400);

  const result = Array.isArray(rows) ? rows[0] : rows;
  const booking = result?.booking;
  const refundEligible: boolean = result?.refund_eligible ?? false;

  if (!booking) return errorResponse("Cancellation did not return a booking", 500);

  if (!refundEligible || !booking.payment_id) {
    return json({ booking, refunded: false });
  }

  const refundAmountPaise = Math.round((booking.price_paid - booking.credit_applied) * 100);

  const rpRes = await fetch(`https://api.razorpay.com/v1/payments/${booking.payment_id}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
    },
    body: JSON.stringify({
      amount: refundAmountPaise,
      notes: { booking_id: booking.id },
    }),
  });

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  if (!rpRes.ok) {
    const errBody = await rpRes.text();
    console.error("Razorpay refund failed:", errBody);
    await adminClient.from("refund_log").insert({
      booking_id: booking.id,
      user_id: booking.user_id,
      razorpay_payment_id: booking.payment_id,
      amount: Math.round(refundAmountPaise / 100),
      status: "failed",
      reason: "Razorpay refund API call failed",
    });
    // Booking stays 'cancelled' (slot already released) even though the
    // refund itself needs a retry — surfaced to the user as a clear message
    // per the brief, rather than failing silently.
    return json({ booking, refunded: false, refundError: "Refund could not be processed automatically. Our team will follow up." }, 200);
  }

  const refund = await rpRes.json();

  const { data: refundedBooking, error: markError } = await adminClient.rpc("mark_booking_refunded", {
    p_booking_id: booking.id,
    p_razorpay_refund_id: refund.id,
    p_razorpay_payment_id: booking.payment_id,
    p_amount: Math.round(refundAmountPaise / 100),
  });

  if (markError) {
    console.error("mark_booking_refunded failed:", markError.message);
    return errorResponse("Refund processed but could not update booking status", 500);
  }

  return json({ booking: refundedBooking, refunded: true });
});