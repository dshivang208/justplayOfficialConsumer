// JustPlay — send-email
//
// Sends a branded transactional email (via Resend) to the given users. Called by
// database triggers through pg_net (see 20261118300000_email_notifications.sql).
// NOT a public endpoint: callers must send the shared secret in `x-email-secret`.
// Deploy with JWT verification off:  supabase functions deploy send-email --no-verify-jwt
//
// Secrets: RESEND_API_KEY, EMAIL_FROM, EMAIL_WEBHOOK_SECRET, APP_URL

import { createClient } from "npm:@supabase/supabase-js@2";
import { APP_URL, renderEmail, sendEmail } from "../_shared/email.ts";

const SECRET = Deno.env.get("EMAIL_WEBHOOK_SECRET");
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SECRET) return json({ error: "EMAIL_WEBHOOK_SECRET is not configured" }, 500);
  if (!safeEqual(req.headers.get("x-email-secret") ?? "", SECRET)) return json({ error: "Forbidden" }, 403);

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const userIds = Array.isArray(b.user_ids) ? b.user_ids.filter((x): x is string => typeof x === "string") : [];
  const subject = typeof b.subject === "string" ? b.subject.slice(0, 150) : "";
  const heading = typeof b.heading === "string" ? b.heading.slice(0, 150) : subject;
  const lines = Array.isArray(b.lines) ? b.lines.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  const ctaText = typeof b.cta_text === "string" ? b.cta_text : undefined;
  const ctaPath = typeof b.cta_path === "string" && b.cta_path.startsWith("/") ? b.cta_path : undefined;
  if (!userIds.length || !subject) return json({ error: "user_ids and subject are required" }, 400);

  const { data: users, error } = await admin.from("users").select("id,email").in("id", userIds);
  if (error) return json({ error: error.message }, 500);

  const html = renderEmail({ heading, lines, ctaText, ctaUrl: ctaPath && APP_URL ? APP_URL + ctaPath : undefined });
  let sent = 0, failed = 0, skipped = 0;
  for (const u of users ?? []) {
    if (!u.email) { skipped++; continue; }
    const r = await sendEmail(u.email, subject, html);
    if (r.ok) sent++; else { failed++; console.error("email failed", u.id, r.error); }
  }
  return json({ sent, failed, skipped });
});
