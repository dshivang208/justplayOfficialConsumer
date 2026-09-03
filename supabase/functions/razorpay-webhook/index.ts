// JustPlay — Backend Phase D: razorpay-webhook
//
// Configure this URL in the Razorpay Dashboard → Settings → Webhooks,
// subscribed to `payment.captured` (and optionally `payment.failed`), with
// a webhook secret set as RAZORPAY_WEBHOOK_SECRET below.
//
// This is the ASYNC BACKUP path called out in the brief: it runs
// independently of whether the user's browser tab is even still open, and
// confirms the booking via the exact same `mark_booking_confirmed` RPC that
// `verify-razorpay-payment` uses — so a booking gets confirmed exactly
// once no matter which path gets there first (the RPC is idempotent: it
// only transitions status 'pending' -> 'confirmed', a no-op if the other
// path already did it).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;

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

  // Razorpay signs the RAW request body — read it as text first, verify,
  // THEN parse, so re-serializing never invalidates the signature.
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) return errorResponse("Missing signature", 400);

  const expected = await hmacHex(RAZORPAY_WEBHOOK_SECRET, rawBody);
  if (!timingSafeEqual(expected, signature)) {
    console.error("Webhook signature mismatch");
    return errorResponse("Invalid signature", 400);
  }

  const event = JSON.parse(rawBody);
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const payment = event?.payload?.payment?.entity;
  const bookingId: string | undefined = payment?.notes?.booking_id;

  await adminClient.from("payment_events").insert({
    booking_id: bookingId ?? null,
    source: "webhook",
    razorpay_event: event?.event ?? "unknown",
    payload: event,
  });

  if (event.event === "payment.captured" && bookingId && payment?.id) {
    const { error } = await adminClient.rpc("mark_booking_confirmed", {
      p_booking_id: bookingId,
      p_payment_id: payment.id,
    });
    if (error) {
      // Log and still 200 — Razorpay will retry on non-2xx, but a booking
      // that's already confirmed or already cancelled isn't a transient
      // failure worth retrying indefinitely.
      console.error("Webhook mark_booking_confirmed failed:", error.message);
    }
  }

  if (event.event === "payment.failed" && bookingId) {
    const { error } = await adminClient.rpc("release_failed_booking", { p_booking_id: bookingId });
    if (error) console.error("Webhook release_failed_booking failed:", error.message);
  }

  // Razorpay only cares about the 2xx — always acknowledge once verified.
  return json({ received: true });
});