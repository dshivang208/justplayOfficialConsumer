// Firebase Cloud Messaging (HTTP v1) helper for Supabase Edge Functions (Deno).
//
// Auth: a Google service account (secret FCM_SERVICE_ACCOUNT = the whole JSON
// key file) is exchanged for a short-lived OAuth2 access token using a
// self-signed RS256 JWT — Web Crypto only, no Node libraries needed.

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

let cachedToken: { value: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccount {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!raw) throw new Error("FCM_SERVICE_ACCOUNT secret is not set");
  const sa = JSON.parse(raw) as ServiceAccount;
  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error("FCM_SERVICE_ACCOUNT is missing project_id / client_email / private_key");
  }
  return sa;
}

const b64url = (input: ArrayBuffer | string) => {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function signJwt(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claims}`));
  return `${header}.${claims}.${b64url(sig)}`;
}

export async function getAccessToken(): Promise<{ token: string; projectId: string }> {
  const sa = loadServiceAccount();
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return { token: cachedToken.value, projectId: sa.project_id };
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: await signJwt(sa),
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google OAuth failed (${res.status}): ${await res.text()}`);
  const body = await res.json();
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return { token: body.access_token, projectId: sa.project_id };
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
export type SendResult = { ok: true } | { ok: false; unregistered: boolean; error: string };

/**
 * Data-only message: the app's service worker builds the notification, so we
 * control title/body/click-target ourselves and a foreground tab can show an
 * in-app toast instead.
 */
export async function sendToToken(
  auth: { token: string; projectId: string },
  fcmToken: string,
  p: PushPayload,
): Promise<SendResult> {
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          data: { title: p.title, body: p.body, url: p.url ?? "/", tag: p.tag ?? "" },
          webpush: { headers: { Urgency: "high", TTL: "86400" } },
        },
      }),
    });
    if (res.ok) return { ok: true };
    const text = await res.text();
    // 404 UNREGISTERED / 400 INVALID_ARGUMENT (malformed token) = this token is dead.
    const dead = res.status === 404 || (res.status === 400 && /INVALID_ARGUMENT/.test(text));
    return { ok: false, unregistered: dead, error: `FCM ${res.status}: ${text.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, unregistered: false, error: e instanceof Error ? e.message : "FCM request failed" };
  }
}
