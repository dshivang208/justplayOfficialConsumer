// JustPlay — Backend Phase D: create-razorpay-order
//
// Called right before opening Razorpay Standard Checkout. Takes a
// `booking_id` (already created via the `create_booking` RPC — see Phase C
// — so the slot is already locked, preventing the double-booking race),
// looks it up AS THE CALLING USER (so RLS guarantees they can only ever
// create an order for their own pending booking), computes the payable
// amount server-side from the booking row (never trusts a client-sent
// amount), and creates a Razorpay order. The Razorpay key SECRET never
// reaches the browser — only the public key_id does, alongside the order id,
// which is everything Razorpay Checkout needs on the frontend.

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
  try {
    const body = await req.json();
    bookingId = body.booking_id;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (!bookingId) return errorResponse("booking_id is required", 400);

  // Scoped to the caller's JWT — RLS ("bookings select own") does the
  // authorization work for us; a stranger's booking id simply returns no row.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: booking, error: bookingError } = await userClient
    .from("bookings")
    .select("id, status, price_paid, credit_applied, user_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) return errorResponse(bookingError.message, 500);
  if (!booking) return errorResponse("Booking not found", 404);
  if (booking.status !== "pending") {
    return errorResponse(`Booking is '${booking.status}', not payable`, 409);
  }

  const payableAmount = Math.max(0, booking.price_paid - booking.credit_applied);
  if (payableAmount <= 0) {
    // Fully covered by wallet credit — no Razorpay order needed at all.
    return json({ fullyCoveredByCredit: true, payableAmount: 0 });
  }

  const amountPaise = Math.round(payableAmount * 100);

  const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: booking.id,
      notes: { booking_id: booking.id, user_id: booking.user_id },
    }),
  });

  if (!rpRes.ok) {
    const errBody = await rpRes.text();
    console.error("Razorpay order creation failed:", errBody);
    return errorResponse("Could not start payment. Please try again.", 502);
  }

  const order = await rpRes.json();

  // Persist the order id with the service role (bookings is otherwise
  // client-unwritable — see Phase C's `revoke update on bookings`).
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error: updateError } = await adminClient
    .from("bookings")
    .update({ razorpay_order_id: order.id })
    .eq("id", booking.id);

  if (updateError) {
    console.error("Failed to persist razorpay_order_id:", updateError.message);
  }

  return json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: RAZORPAY_KEY_ID,
    bookingId: booking.id,
  });
});