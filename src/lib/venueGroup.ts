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
};

export async function fetchVenueGroupMessages(
  groupId: string,
  venueName: string,
): Promise<VenueGroupMessage[]> {
  let rows: MessageRow[];
  const full = await supabase
    .from("venue_group_messages")
    .select("id, body, created_at, sender_user_id, sender_kind")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(300)
    .returns<MessageRow[]>();
  if (full.error) {
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
  } else {
    rows = full.data ?? [];
  }

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
