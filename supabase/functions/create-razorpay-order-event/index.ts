// JustPlay — create-razorpay-order-event
//
// The event-registration equivalent of create-razorpay-order. Takes a
// `registration_id` (already created via `start_event_registration`, which
// reserves the spot as 'pending'), looks it up AS THE CALLING USER (RLS —
// "event_registrations select own" — guarantees they can only ever create
// an order for their own pending registration), computes the payable
// amount server-side from the registration's own `amount_paid` (itself
// server-priced from `events.entry_fee` when the registration was created —
// never a client-sent amount), and creates a Razorpay order. The secret key
// never reaches the browser — only the public key_id does.

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

  let registrationId: string | undefined;
  try {
    const body = await req.json();
    registrationId = body.registration_id;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (!registrationId) return errorResponse("registration_id is required", 400);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: reg, error: regError } = await userClient
    .from("event_registrations")
    .select("id, event_id, status, amount_paid, user_id")
    .eq("id", registrationId)
    .maybeSingle();

  if (regError) return errorResponse(regError.message, 500);
  if (!reg) return errorResponse("Registration not found", 404);
  if (reg.status !== "pending") {
    return errorResponse(`Registration is '${reg.status}', not payable`, 409);
  }

  const payableAmount = Math.max(0, reg.amount_paid);
  if (payableAmount <= 0) {
    // Shouldn't happen — start_event_registration refuses free events — but
    // handle it the same way create-razorpay-order does, just in case.
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
      receipt: reg.id,
      notes: { event_registration_id: reg.id, event_id: reg.event_id, user_id: reg.user_id },
    }),
  });

  if (!rpRes.ok) {
    const errBody = await rpRes.text();
    console.error("Razorpay order creation failed (event):", errBody);
    return errorResponse("Could not start payment. Please try again.", 502);
  }

  const order = await rpRes.json();

  // Persist the order id with the service role (event_registrations has no
  // client UPDATE policy — same lockdown as bookings).
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { error: updateError } = await adminClient
    .from("event_registrations")
    .update({ razorpay_order_id: order.id })
    .eq("id", reg.id);

  if (updateError) {
    console.error("Failed to persist razorpay_order_id (event):", updateError.message);
  }

  return json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: RAZORPAY_KEY_ID,
    registrationId: reg.id,
  });
});