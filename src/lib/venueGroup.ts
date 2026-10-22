/**
 * Venue community group — the optional announcement group a venue owner can
 * open from the Partner app. Consumers only ever see it on that venue's own
 * detail page: it lives in its own tables (venue_groups, venue_group_members,
 * venue_group_messages), deliberately separate from the community `groups`
 * feature, so it never appears on /groups or in "my groups".
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
};

export type VenueGroupUpdate = {
  id: string;
  body: string;
  createdAt: string;
};

type GroupRow = {
  id: string;
  venue_id: string;
  name: string;
  description: string | null;
  member_count: number | string;
  is_member: boolean;
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

export async function fetchVenueGroupUpdates(groupId: string): Promise<VenueGroupUpdate[]> {
  const { data, error } = await supabase
    .from("venue_group_messages")
    .select("id, body, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    console.error("fetchVenueGroupUpdates failed:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at }));
}