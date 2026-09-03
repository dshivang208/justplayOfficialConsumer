/**
 * Backend Phase D: Razorpay Standard Checkout (frontend half only).
 *
 * Everything that needs the Razorpay secret key lives in the Edge Functions
 * (`create-razorpay-order`, `verify-razorpay-payment`, `razorpay-webhook`,
 * `cancel-booking-refund`) — this file only loads the public checkout.js
 * script and opens the modal with an order id + public key the backend
 * already generated.
 */
import { supabase } from "./supabaseClient";

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  prefill?: { name?: string; contact?: string; email?: string };
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
};

let scriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Not in a browser"));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the payment gateway. Check your connection."));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

async function callEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw new Error(error.message || `${name} failed`);
  if (!data) throw new Error(`${name} returned no data`);
  return data;
}

export type PayForBookingResult =
  | { status: "confirmed"; bookingId: string }
  | { status: "cancelled" };

/**
 * Runs the full Phase D flow for one booking:
 *   create-razorpay-order -> (skip if fully covered by wallet credit)
 *   -> open Checkout -> on success, verify-razorpay-payment
 * `create_booking` (the atomic slot-lock RPC) must already have been called
 * BEFORE this — this function only handles taking payment for a booking
 * that already exists in 'pending' state.
 */
export async function payForBooking(params: {
  bookingId: string;
  userName?: string;
  userPhone?: string;
  userEmail?: string;
}): Promise<PayForBookingResult> {
  const order = await callEdgeFunction<{
    fullyCoveredByCredit?: boolean;
    orderId?: string;
    amount?: number;
    currency?: string;
    keyId?: string;
  }>("create-razorpay-order", { booking_id: params.bookingId });

  if (order.fullyCoveredByCredit) {
    await callEdgeFunction("confirm-free-booking", { booking_id: params.bookingId });
    return { status: "confirmed", bookingId: params.bookingId };
  }

  await loadRazorpayScript();

  const prefill: { name?: string; contact?: string; email?: string } = {};
  if (params.userName) prefill.name = params.userName;
  if (params.userPhone) prefill.contact = params.userPhone;
  if (params.userEmail) prefill.email = params.userEmail;

  return new Promise((resolve, reject) => {
    const razorpay = new window.Razorpay!({
      key: order.keyId!,
      amount: order.amount!,
      currency: order.currency!,
      order_id: order.orderId!,
      name: "JustPlay",
      description: "Slot booking",
      prefill,
      theme: { color: "#16a34a" },
      handler: (response) => {
        void callEdgeFunction("verify-razorpay-payment", {
          booking_id: params.bookingId,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        })
          .then(() => resolve({ status: "confirmed", bookingId: params.bookingId }))
          .catch(reject);
      },
      modal: {
        ondismiss: () => resolve({ status: "cancelled" }),
      },
    });
    razorpay.open();
  });
}