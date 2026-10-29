// JustPlay — send-push
//
// Delivers a web push (via Firebase Cloud Messaging) to every browser the
// given users registered for the given app. Called by:
//   • database triggers through pg_net (see 20261025010000_fcm_push.sql)
//   • admin-send-notification (admin broadcasts with the "push" channel)
//
// NOT a public endpoint: callers must send the shared secret in the
// `x-push-secret` header. Deploy with JWT verification off, since pg_net
// has no user JWT:   supabase functions deploy send-push --no-verify-jwt
//
// Secrets:  FCM_SERVICE_ACCOUNT (service-account JSON), PUSH_WEBHOOK_SECRET.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getAccessToken, sendToToken } from "../_shared/fcm.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET");

const APPS = ["consumer", "partner", "admin"];
const CONCURRENCY = 20;

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SECRET) return json({ error: "PUSH_WEBHOOK_SECRET is not configured" }, 500);
  if (!safeEqual(req.headers.get("x-push-secret") ?? "", SECRET)) return json({ error: "Forbidden" }, 403);

  let body: { user_ids?: unknown; app?: unknown; title?: unknown; body?: unknown; url?: unknown; tag?: unknown; image?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const userIds = Array.isArray(body.user_ids) ? body.user_ids.filter((x): x is string => typeof x === "string") : [];
  const app = typeof body.app === "string" ? body.app : "";
  if (userIds.length === 0 || !APPS.includes(app)) return json({ error: "user_ids and a valid app are required" }, 400);
  const title = typeof body.title === "string" && body.title ? body.title : "JustPlay";
  const text = typeof body.body === "string" ? body.body : "";
  const url = typeof body.url === "string" && body.url.startsWith("/") ? body.url : "/";
  const tag = typeof body.tag === "string" ? body.tag : undefined;
  // Optional big picture (https only — the browser/OS downloads it itself).
  const image = typeof body.image === "string" && /^https:\/\/\S+$/.test(body.image) && body.image.length <= 1000 ? body.image : undefined;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Collect tokens in pages so a big broadcast doesn't hit the row cap.
  const tokens: { id: string; token: string }[] = [];
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await admin
      .from("push_tokens")
      .select("id, token")
      .eq("app", app)
      .in("user_id", userIds.slice(i, i + 200));
    if (error) return json({ error: error.message }, 500);
    tokens.push(...(data ?? []));
  }
  if (tokens.length === 0) return json({ sent: 0, failed: 0, removed: 0 });

  let auth;
  try {
    auth = await getAccessToken();
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    console.error("FCM auth failed:", why);
    return json({ error: `FCM is not configured correctly: ${why}` }, 500);
  }

  let sent = 0;
  let failed = 0;
  const dead: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < tokens.length; i += CONCURRENCY) {
    const batch = tokens.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((t) => sendToToken(auth, t.token, { title, body: text, url, ...(tag ? { tag } : {}), ...(image ? { image } : {}) })));
    results.forEach((r, idx) => {
      if (r.ok) sent++;
      else {
        failed++;
        if (r.unregistered) dead.push(batch[idx]!.id);
        else if (errors.length < 5) errors.push(r.error);
      }
    });
  }

  if (dead.length > 0) {
    const { error } = await admin.from("push_tokens").delete().in("id", dead);
    if (error) console.error("push_tokens cleanup failed:", error.message);
  }
  if (errors.length > 0) console.error("push errors:", errors.join(" | "));

  return json({ sent, failed, removed: dead.length, errors });
});
