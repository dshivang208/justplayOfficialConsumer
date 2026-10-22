/**
 * Group chat media: rich messages (photos, videos, GIFs, stickers) on top of
 * the original text-only chat. Needs migration 20261023010000_group_chat_media.sql.
 *
 *  - photos/videos: uploaded to the private `group-chat` bucket under
 *    <group_id>/…, shown through short-lived signed URLs (cached here)
 *  - GIFs: https GIPHY URLs (search needs VITE_GIPHY_API_KEY)
 *  - stickers: a short emoji string rendered large, no bubble
 */
import { supabase } from "@/lib/supabaseClient";

export type ChatMessageType = "text" | "image" | "video" | "gif" | "sticker";

export type ChatMessage = {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl: string | null;
  type: ChatMessageType;
  /** Text body, caption for media, or the sticker emoji. */
  text: string;
  /** Ready-to-render URL for image / video / gif (signed for uploads). */
  mediaSrc: string | null;
  createdAt: string;
};

const BUCKET = "group-chat";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const SIGNED_URL_TTL_S = 60 * 60;

const GIPHY_KEY = import.meta.env["VITE_GIPHY_API_KEY"] as string | undefined;
export const gifSearchAvailable = Boolean(GIPHY_KEY);

// path -> { url, expiresAt } so a refetch on every new message doesn't
// re-sign every photo in the chat.
const signedCache = new Map<string, { url: string; expiresAt: number }>();

async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of paths) {
    const hit = signedCache.get(p);
    if (hit && hit.expiresAt - 60_000 > now) out[p] = hit.url;
    else missing.push(p);
  }
  if (missing.length > 0) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(missing, SIGNED_URL_TTL_S);
    if (error) {
      console.error("sign chat media failed:", error.message);
    } else {
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) {
          signedCache.set(row.path, {
            url: row.signedUrl,
            expiresAt: now + SIGNED_URL_TTL_S * 1000,
          });
          out[row.path] = row.signedUrl;
        }
      }
    }
  }
  return out;
}

type Row = {
  id: string;
  group_id: string;
  sender_user_id: string;
  message_text: string;
  message_type: ChatMessageType;
  media_path: string | null;
  media_url: string | null;
  created_at: string;
};

type Profile = { name: string; photoUrl: string | null };

async function fetchProfiles(ids: string[]): Promise<Record<string, Profile>> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return {};
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, name, profile_photo_url")
    .in("id", unique);
  if (error) {
    console.error("fetchProfiles failed:", error.message);
    return {};
  }
  const map: Record<string, Profile> = {};
  for (const r of data ?? [])
    map[r.id] = { name: r.name || "Player", photoUrl: r.profile_photo_url };
  return map;
}

export async function fetchChatMessages(groupId: string): Promise<ChatMessage[]> {
  let rows: Row[];
  const full = await supabase
    .from("group_messages")
    .select(
      "id, group_id, sender_user_id, message_text, message_type, media_path, media_url, created_at",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .returns<Row[]>();
  if (full.error) {
    // Media migration not applied yet: fall back to the original text-only columns
    // so the chat keeps working until it is.
    const legacy = await supabase
      .from("group_messages")
      .select("id, group_id, sender_user_id, message_text, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });
    if (legacy.error) throw new Error(legacy.error.message);
    rows = (legacy.data ?? []).map((r) => ({
      ...r,
      message_type: "text" as const,
      media_path: null,
      media_url: null,
    }));
  } else {
    rows = full.data ?? [];
  }

  const [profiles, signed] = await Promise.all([
    fetchProfiles(rows.map((r) => r.sender_user_id)),
    signPaths(rows.map((r) => r.media_path).filter((p): p is string => Boolean(p))),
  ]);

  return rows.map((r) => ({
    id: r.id,
    groupId: r.group_id,
    senderId: r.sender_user_id,
    senderName: profiles[r.sender_user_id]?.name ?? "Member",
    senderPhotoUrl: profiles[r.sender_user_id]?.photoUrl ?? null,
    type: r.message_type ?? "text",
    text: r.message_text ?? "",
    mediaSrc: r.media_path ? (signed[r.media_path] ?? null) : r.media_url,
    createdAt: r.created_at,
  }));
}

export function validateAttachment(file: File): string | null {
  if (file.type.startsWith("image/")) {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type))
      return "Use a JPG, PNG, WebP or GIF image.";
    if (file.size > MAX_IMAGE_BYTES) return "Images can be up to 10 MB.";
    return null;
  }
  if (file.type.startsWith("video/")) {
    if (!["video/mp4", "video/webm", "video/quicktime"].includes(file.type))
      return "Use an MP4, WebM or MOV video.";
    if (file.size > MAX_VIDEO_BYTES) return "Videos can be up to 25 MB.";
    return null;
  }
  return "Only photos and videos can be attached.";
}

function extOf(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return file.type.split("/")[1] ?? "bin";
}

async function send(
  groupId: string,
  type: ChatMessageType,
  args: { text?: string; mediaPath?: string; mediaUrl?: string },
) {
  const { error } = await supabase.rpc("send_group_chat_message", {
    p_group_id: groupId,
    p_type: type,
    p_text: args.text ?? null,
    p_media_path: args.mediaPath ?? null,
    p_media_url: args.mediaUrl ?? null,
  });
  if (!error) return;
  // New function not installed yet (migration pending): plain text still works
  // through the original function; media can't be sent until the SQL is run.
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
    if (type === "text") {
      const legacy = await supabase.rpc("send_group_message", {
        p_group_id: groupId,
        p_message: args.text ?? "",
      });
      if (legacy.error) throw new Error(legacy.error.message);
      return;
    }
    throw new Error(
      "Photos, videos, GIFs and stickers aren't enabled yet. Ask the admin to finish setup.",
    );
  }
  throw new Error(error.message);
}

export const sendText = (groupId: string, text: string) => send(groupId, "text", { text });
export const sendSticker = (groupId: string, emoji: string) =>
  send(groupId, "sticker", { text: emoji });
export const sendGif = (groupId: string, url: string) => send(groupId, "gif", { mediaUrl: url });

/** Uploads the file into this group's folder, then posts the message. */
export async function sendAttachment(groupId: string, file: File, caption: string) {
  const problem = validateAttachment(file);
  if (problem) throw new Error(problem);
  const path = `${groupId}/${crypto.randomUUID()}.${extOf(file)}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw new Error(upErr.message);
  await send(groupId, file.type.startsWith("video/") ? "video" : "image", {
    text: caption,
    mediaPath: path,
  });
}

// ── GIF search (GIPHY) ───────────────────────────────────────────────────
export type GifResult = { id: string; previewUrl: string; url: string };

export async function searchGifs(query: string): Promise<GifResult[]> {
  if (!GIPHY_KEY) return [];
  const q = query.trim();
  const endpoint = q ? "search" : "trending";
  const params = new URLSearchParams({ api_key: GIPHY_KEY, limit: "24", rating: "pg-13" });
  if (q) params.set("q", q);
  const res = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params.toString()}`);
  if (!res.ok) throw new Error("GIF search is unavailable right now.");
  const json = (await res.json()) as {
    data?: {
      id: string;
      images: { fixed_height_small: { url: string }; fixed_height: { url: string } };
    }[];
  };
  return (json.data ?? []).map((g) => ({
    id: g.id,
    previewUrl: g.images.fixed_height_small.url,
    url: g.images.fixed_height.url,
  }));
}
