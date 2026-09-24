// JustPlay — Backend Phase D: cancel-booking-refund
//
// Wraps Phase C's `cancel_booking` RPC (which does the atomic "cancel +
// release slot(s)" step) and, when eligible, calls the Razorpay Refunds
// API and logs the result to `refund_log` via `mark_booking_refunded`.
//
// ADMIN OVERRIDE (Admin Backend Phase C): this is the literal "one refund
// code path across the whole platform" the admin app's brief calls for —
// not a second near-duplicate function. `cancel_booking` itself already
// had a `v_is_partner` bypass of the "must be your own booking" check
// (Partner Phase C); this file adds the matching admin bypass, plus two
// things a pure self-service consumer/partner cancellation never needs:
//   1. Refunding a booking that's ALREADY cancelled — the common real
//      support case (customer cancelled outside the free window, support
//      later approves an exception). cancel_booking() can't be called
//      again on an already-cancelled row (BOOKING_NOT_CANCELLABLE), so
//      this path skips straight to the Razorpay call + mark_booking_refunded.
//   2. A custom partial refund amount instead of always the full amount,
//      and bypassing the 2-hour free-cancellation-window eligibility
//      check entirely — that's what "override" means here.
// Only honored when the caller is verified against admin_users
// server-side (never trusted from the request body alone).

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
  let adminOverride: { refundAmount?: number } | undefined;
  try {
    const body = await req.json();
    bookingId = body.booking_id;
    reason = body.reason;
    adminOverride = body.admin_override;
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }
  if (!bookingId) return errorResponse("booking_id is required", 400);

  // Runs as the calling user — cancel_booking() itself checks ownership
  // again internally (now also recognizing a partner at the venue, or an
  // admin — see the migration comment on cancel_booking), belt-and-suspenders.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Admin-ness is verified server-side against admin_users — never
  // trusted from the request body just because `admin_override` was sent.
  let callerAdminId: string | null = null;
  if (adminOverride) {
    const { data: authUser } = await userClient.auth.getUser();
    const callerId = authUser?.user?.id;
    if (callerId) {
      const { data: adminRow } = await serviceClient
        .from("admin_users")
        .select("id")
        .eq("id", callerId)
        .maybeSingle();
      if (adminRow) callerAdminId = adminRow.id;
    }
    if (!callerAdminId) return errorResponse("admin_override requires an admin session", 403);
  }

  const { data: existingBooking, error: fetchError } = await serviceClient
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();
  if (fetchError) return errorResponse(fetchError.message, 500);
  if (!existingBooking) return errorResponse("Booking not found", 404);

  let booking = existingBooking;
  let refundEligible = false;

  if (["pending", "confirmed"].includes(booking.status)) {
    const { data: rows, error: cancelError } = await userClient.rpc("cancel_booking", {
      p_booking_id: bookingId,
      p_reason: reason ?? null,
    });
    if (cancelError) return errorResponse(cancelError.message, 400);

    const result = Array.isArray(rows) ? rows[0] : rows;
    booking = result?.booking;
    if (!booking) return errorResponse("Cancellation did not return a booking", 500);

    // Normal rule: eligible only within the free-cancellation window AND
    // actually paid online. Admin override deliberately bypasses the
    // window — that's the entire point of a manual override.
    refundEligible = callerAdminId ? true : (result?.refund_eligible ?? false);
  } else if (booking.status === "cancelled" && callerAdminId) {
    // Already cancelled, no refund yet — admin approving an exception.
    // Nothing to release (the slot was already freed when it was first
    // cancelled), so this skips cancel_booking entirely and goes straight
    // to the refund step below.
    refundEligible = true;
    if (reason && !booking.cancellation_reason) {
      const { data: updated } = await serviceClient
        .from("bookings")
        .update({ cancellation_reason: reason })
        .eq("id", bookingId)
        .select()
        .maybeSingle();
      if (updated) booking = updated;
    }
  } else {
    return json({ booking, refunded: false });
  }

  if (!refundEligible || !booking.payment_id || booking.payment_status === "refunded") {
    return json({ booking, refunded: false });
  }

  const fullAmountRupees = booking.price_paid - booking.credit_applied;
  let refundAmountRupees = fullAmountRupees;
  if (callerAdminId && typeof adminOverride?.refundAmount === "number") {
    refundAmountRupees = Math.max(0, Math.min(adminOverride.refundAmount, fullAmountRupees));
  }
  if (refundAmountRupees <= 0) return json({ booking, refunded: false });

  const refundAmountPaise = Math.round(refundAmountRupees * 100);

  const rpRes = await fetch(`https://api.razorpay.com/v1/payments/${booking.payment_id}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
    },
    body: JSON.stringify({
      amount: refundAmountPaise,
      notes: { booking_id: booking.id, admin_override: callerAdminId ? "true" : "false" },
    }),
  });

  const adminClient = serviceClient;

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
    return json(
      { booking, refunded: false, refundError: "Refund could not be processed automatically. Our team will follow up." },
      200,
    );
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

  if (callerAdminId) {
    const { error: auditError } = await adminClient.from("admin_audit_log").insert({
      admin_id: callerAdminId,
      action: "booking.refund_override",
      target_table: "bookings",
      target_id: booking.id,
      details: {
        refundAmountRupees,
        fullAmountRupees,
        reason: reason ?? null,
        wasAlreadyCancelled: existingBooking.status === "cancelled",
      },
    });
    if (auditError) console.error("admin_audit_log insert failed:", auditError.message);
  }

  return json({ booking: refundedBooking, refunded: true });
});