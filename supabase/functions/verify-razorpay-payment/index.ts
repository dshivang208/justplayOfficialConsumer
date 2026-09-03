// JustPlay — Backend Phase D: verify-razorpay-payment
//
// Called from the frontend's Razorpay Checkout `handler` callback, i.e.
// right after Razorpay reports success client-side. Per the brief, that
// client-side event is NEVER trusted on its own — this function
// independently recomputes the HMAC-SHA256 signature Razorpay generated
// over `order_id|payment_id` using the (server-only) key secret, and only
// calls `mark_booking_confirmed` if it matches. A spoofed or replayed
// success callback fails the signature check and confirms nothing.
//
// The `razorpay-webhook` function (below/alongside) calls the exact same
// `mark_booking_confirmed` RPC as a fully independent backup path, so a
// confirmation still lands even if the browser tab closes before this
// function's response comes back.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET")!;

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return errorResponse("Missing Authorization header", 401);

  let payload: {
    booking_id?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;
  if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return errorResponse("booking_id, razorpay_order_id, razorpay_payment_id and razorpay_signature are all required", 400);
  }

  // Confirm the caller actually owns this booking before we do anything else.
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: booking } = await userClient
    .from("bookings")
    .select("id, razorpay_order_id")
    .eq("id", booking_id)
    .maybeSingle();

  if (!booking) return errorResponse("Booking not found", 404);
  if (booking.razorpay_order_id !== razorpay_order_id) {
    return errorResponse("Order id does not match this booking", 400);
  }

  const expectedSignature = await hmacHex(
    RAZORPAY_KEY_SECRET,
    `${razorpay_order_id}|${razorpay_payment_id}`,
  );

  if (!timingSafeEqual(expectedSignature, razorpay_signature)) {
    console.error("Razorpay signature mismatch for booking", booking_id);
    return errorResponse("Payment signature verification failed", 400);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  await adminClient.from("payment_events").insert({
    booking_id,
    source: "client_verify",
    razorpay_event: "signature_verified",
    payload: { razorpay_order_id, razorpay_payment_id },
  });

  const { data: confirmed, error: confirmError } = await adminClient.rpc("mark_booking_confirmed", {
    p_booking_id: booking_id,
    p_payment_id: razorpay_payment_id,
  });

  if (confirmError) {
    console.error("mark_booking_confirmed failed:", confirmError.message);
    return errorResponse("Could not confirm booking", 500);
  }

  return json({ confirmed: true, booking: confirmed });
});