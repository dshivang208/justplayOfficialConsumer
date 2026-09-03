// JustPlay — Backend Phase B: mock-otp-verify
//
// This function does three things:
//   1. Mock-validates the OTP the user typed (any 6-digit code today).
//   2. Looks up (or lets Supabase Auth create) a real `auth.users` row for
//      this phone number, and mints a REAL session for it — WITHOUT ever
//      sending a real SMS or email. It does this via `admin.generateLink`,
//      which is the officially-documented way to get a redeemable OTP
//      token server-side for a custom/headless auth UI, driven off a
//      synthetic per-phone email instead of a real one.
//   3. Makes sure `public.users.phone` holds the REAL phone number (the
//      synthetic email is an internal implementation detail — it is never
//      shown anywhere and the app never treats it as the user's identity).
//
// ─────────────────────────────────────────────────────────────────────────
// SWAP POINT FOR REAL SMS (Twilio/MSG91 etc.):
// Replace ONLY `isValidMockOtp` with a real lookup against a per-phone OTP
// challenge you issued at "send OTP" time (e.g. a short-lived row in a new
// `otp_challenges` table, checked and consumed here). Everything below that
// — user lookup, `generateLink`, and the `public.users` upsert — stays the
// same, because it isn't about verifying the code, it's about turning an
// already-verified phone into a real Supabase session.
// ─────────────────────────────────────────────────────────────────────────

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** TODO(real-sms): replace with a real per-phone OTP challenge lookup. */
function isValidMockOtp(code: string) {
  return /^\d{6}$/.test(code);
}

function toE164(rawDigits: string) {
  const digits = rawDigits.replace(/\D/g, "").slice(-10);
  return { digits, e164: `+91${digits}` };
}

/**
 * Supabase's session-minting APIs used here are email-shaped, but phone
 * stays the one real, user-facing identifier everywhere else in the app
 * (public.users.phone). This address is never sent anywhere and is never
 * surfaced in the UI.
 */
function syntheticEmail(e164: string) {
  return `${e164.replace("+", "")}@phone.justplay.internal`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { phone?: unknown; otp?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { phone, otp } = body;
  if (typeof phone !== "string" || typeof otp !== "string") {
    return json({ error: "phone and otp are required" }, 400);
  }

  if (!isValidMockOtp(otp)) {
    return json({ error: "Enter the 6-digit code we sent you." }, 400);
  }

  const { digits, e164 } = toE164(phone);
  if (digits.length !== 10) {
    return json({ error: "Enter a valid 10-digit Indian mobile number." }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Our own `public.users` table is the source of truth for "is this phone
  // number already a JustPlay account?" — simpler and more explicit than
  // inferring it from auth.users' internal bookkeeping.
  const { data: existing, error: lookupError } = await admin
    .from("users")
    .select("id, name, email")
    .eq("phone", e164)
    .maybeSingle();

  if (lookupError) return json({ error: lookupError.message }, 500);
  const isNewUser = !existing;

  const email = syntheticEmail(e164);
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return json({ error: linkError?.message ?? "Could not start a session for this number." }, 500);
  }

  const userId = linkData.user.id;

  // A DB trigger (Phase A, patched in Phase B) already inserted a bare row
  // the moment this auth user was first created. Make sure the REAL phone
  // (not the synthetic email) ends up on it, and preserve any existing
  // name/email for a returning user.
  const { data: upserted, error: upsertError } = await admin
    .from("users")
    .upsert(
      {
        id: userId,
        phone: e164,
        name: existing?.name ?? "",
        email: existing?.email ?? null,
      },
      { onConflict: "id" },
    )
    .select("id, phone, name, email, profile_photo_url, created_at")
    .single();

  if (upsertError) return json({ error: upsertError.message }, 500);

  return json({
    tokenHash: linkData.properties.hashed_token,
    isNewUser,
    profile: upserted,
  });
});