/**
 * Venue community group — the optional group a venue owner can open from the
 * Partner app. Consumers only ever see it on that venue's own detail page: it
 * lives in its own tables (venue_groups, venue_group_members,
 * venue_group_messages), deliberately separate from the community `groups`
 * feature, so it never appears on /groups or in "my groups".
 *
 * It is a TWO-WAY chat: members and the venue both post. (The owner can
 * switch the group back to "announcements only" with `members_can_post`.)
 * Two-way posting needs migration 20261023030000_venue_group_two_way_chat.sql;
 * until it is applied the group keeps working as a read-only feed.
 *
 * Everything is gated server-side: `get_venue_group` returns no row unless
 * JustPlay admin has enabled the facility for the venue, the owner created
 * the group and hasn't paused it, and the venue is active.
 */
import { supabase } from "./supabaseClient";

export type VenueGroup = {
  id: string;
  venueId: string;
  name: string;
  description: string;
  memberCount: number;
  isMember: boolean;
  /** False when the owner made it announcements-only (or the two-way
   *  migration hasn't been applied yet). */
  membersCanPost: boolean;
};

export type VenueGroupMessage = {
  id: string;
  body: string;
  createdAt: string;
  /** "venue" = posted by the venue's owner/staff; "member" = a player. */
  kind: "venue" | "member";
  senderId: string | null;
  senderName: string;
  senderPhotoUrl: string | null;
  /** "text" until the media migration is applied. */
  type: "text" | "image" | "video" | "file";
  /** Signed, ready-to-render URL for image / video / file attachments. */
  mediaSrc: string | null;
  fileName: string | null;
  fileSize: number | null;
  mimeType: string | null;
};

type GroupRow = {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  member_count: number | string;
  is_member: boolean;
  /** Absent until the two-way migration is applied. */
  members_can_post?: boolean;
};

export async function fetchVenueGroup(venueId: string): Promise<VenueGroup | null> {
  const { data, error } = await supabase.rpc("get_venue_group", { p_venue_id: venueId });
  if (error) {
    console.error("fetchVenueGroup failed:", error.message);
    return null;
  }
  const row = ((data ?? []) as GroupRow[])[0];
  if (!row) return null;
  return {
    id: row.id,
    venueId: row.venue_id,
    name: row.name,
    description: row.description ?? "",
    memberCount: Number(row.member_count),
    isMember: row.is_member,
    membersCanPost: row.members_can_post ?? false,
  };
}

export async function joinVenueGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("join_venue_group", { p_group_id: groupId });
  if (error) {
    throw new Error(
      error.message.includes("GROUP_UNAVAILABLE")
        ? "This group isn't available right now."
        : "Couldn't join the group. Try again.",
    );
  }
}

export async function leaveVenueGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_venue_group", { p_group_id: groupId });
  if (error) throw new Error("Couldn't leave the group. Try again.");
}

type MessageRow = {
  id: string;
  body: string;
  created_at: string;
  sender_user_id?: string | null;
  sender_kind?: "venue" | "member";
  /** Absent until 20261023040000_venue_group_media.sql is applied. */
  message_type?: "text" | "image" | "video" | "file";
  media_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
};

const BUCKET = "venue-group-chat";
const SIGNED_URL_TTL_S = 60 * 60;
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
      console.error("sign venue group media failed:", error.message);
    } else {
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) {
          signedCache.set(row.path, { url: row.signedUrl, expiresAt: now + SIGNED_URL_TTL_S * 1000 });
          out[row.path] = row.signedUrl;
        }
      }
    }
  }
  return out;
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const FILE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

/** Returns the attachment kind, or throws a friendly error. */
export function classifyAttachment(file: File): "image" | "video" | "file" {
  if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    if (file.size > MAX_IMAGE_BYTES) throw new Error("Photos can be up to 10 MB.");
    return "image";
  }
  if (["video/mp4", "video/webm", "video/quicktime"].includes(file.type)) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error("Videos can be up to 25 MB.");
    return "video";
  }
  if (FILE_TYPES.includes(file.type)) {
    if (file.size > MAX_FILE_BYTES) throw new Error("Files can be up to 25 MB.");
    return "file";
  }
  throw new Error("Attach a photo, an MP4/WebM/MOV video, or a PDF/Office/text file.");
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extOf(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return file.type.split("/")[1] ?? "bin";
}

/** Uploads into this group's folder, then posts the attachment message. */
export async function sendVenueGroupAttachment(
  groupId: string,
  file: File,
  caption: string,
): Promise<void> {
  const type = classifyAttachment(file);
  const path = `${groupId}/${crypto.randomUUID()}.${extOf(file)}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) {
    throw new Error(
      /bucket not found/i.test(upErr.message)
        ? "Attachments aren't enabled yet. Please try again later."
        : "Couldn't upload that file. Try again.",
    );
  }
  const { error } = await supabase.rpc("send_venue_group_media", {
    p_group_id: groupId,
    p_type: type,
    p_path: path,
    p_file_name: file.name,
    p_file_size: file.size,
    p_mime_type: file.type,
    p_body: caption,
  });
  if (!error) return;
  await supabase.storage.from(BUCKET).remove([path]);
  const code = Object.keys(SEND_ERRORS).find((k) => error.message.includes(k));
  throw new Error(code ? SEND_ERRORS[code]! : "Couldn't send that attachment. Try again.");
}

export async function fetchVenueGroupMessages(
  groupId: string,
  venueName: string,
): Promise<VenueGroupMessage[]> {
  let rows: MessageRow[];
  const media = await supabase
    .from("venue_group_messages")
    .select(
      "id, body, created_at, sender_user_id, sender_kind, message_type, media_path, file_name, file_size, mime_type",
    )
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(300)
    .returns<MessageRow[]>();
  if (!media.error) {
    rows = media.data ?? [];
  } else {
    const full = await supabase
      .from("venue_group_messages")
      .select("id, body, created_at, sender_user_id, sender_kind")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(300)
      .returns<MessageRow[]>();
    if (!full.error) {
      rows = full.data ?? [];
    } else {
      // Two-way migration not applied yet — read the original columns.
      const legacy = await supabase
        .from("venue_group_messages")
        .select("id, body, created_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (legacy.error) {
        console.error("fetchVenueGroupMessages failed:", legacy.error.message);
        return [];
      }
      rows = legacy.data ?? [];
    }
  }

  const signed = await signPaths(
    rows.map((r) => r.media_path).filter((x): x is string => Boolean(x)),
  );

  const ids = Array.from(
    new Set(rows.map((r) => r.sender_user_id).filter((id): id is string => Boolean(id))),
  );
  const profiles: Record<string, { name: string; photoUrl: string | null }> = {};
  if (ids.length > 0) {
    const { data } = await supabase
      .from("public_profiles")
      .select("id, name, profile_photo_url")
      .in("id", ids);
    for (const p of data ?? []) {
      profiles[p.id] = { name: p.name || "Player", photoUrl: p.profile_photo_url };
    }
  }

  return rows.map((r) => {
    const kind = r.sender_kind ?? "venue";
    const profile = r.sender_user_id ? profiles[r.sender_user_id] : undefined;
    return {
      id: r.id,
      body: r.body,
      createdAt: r.created_at,
      kind,
      senderId: r.sender_user_id ?? null,
      senderName: kind === "venue" ? venueName : (profile?.name ?? "Member"),
      senderPhotoUrl: kind === "venue" ? null : (profile?.photoUrl ?? null),
      type: r.message_type ?? "text",
      mediaSrc: r.media_path ? (signed[r.media_path] ?? null) : null,
      fileName: r.file_name ?? null,
      fileSize: r.file_size ?? null,
      mimeType: r.mime_type ?? null,
    };
  });
}

const SEND_ERRORS: Record<string, string> = {
  MEMBERS_CANNOT_POST: "Only the venue can post in this group right now.",
  NOT_A_MEMBER: "Join the group to send messages.",
  GROUP_UNAVAILABLE: "This group isn't available right now.",
  MESSAGE_TOO_LONG: "Messages can be up to 1000 characters.",
  TOO_FAST: "You're sending messages too fast. Wait a moment.",
  AUTH_REQUIRED: "Please sign in to send messages.",
};

export async function sendVenueGroupMessage(groupId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc("send_venue_group_message", {
    p_group_id: groupId,
    p_body: body,
  });
  if (!error) return;
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
    throw new Error("Chat isn't enabled yet. Please try again later.");
  }
  const code = Object.keys(SEND_ERRORS).find((k) => error.message.includes(k));
  throw new Error(code ? SEND_ERRORS[code]! : "Couldn't send that message. Try again.");
}

export async function deleteMyVenueGroupMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_my_venue_group_message", {
    p_message_id: messageId,
  });
  if (error) throw new Error("Couldn't delete that message.");
}
