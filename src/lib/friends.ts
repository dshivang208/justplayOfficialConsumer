import { supabase } from "./supabaseClient";

export type Friend = { userId: string; name: string; phone: string | null; photoUrl: string | null };
export type FriendRequest = { requestId: string; userId: string; name: string };
export type DeviceContact = { name: string; phone10: string };
export type ContactMatch = DeviceContact & { userId: string | null; isFriend: boolean; appName?: string | undefined };

/** Last 10 digits of any phone-ish string ("+91 98765-43210" -> "9876543210"). */
export const phone10 = (p: string) => p.replace(/\D/g, "").slice(-10);

export async function fetchFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc("my_friends");
  if (error) throw new Error(error.message);
  return ((data ?? []) as { user_id: string; name: string; phone: string | null; photo_url: string | null }[]).map((r) => ({
    userId: r.user_id,
    name: r.name || "Player",
    phone: r.phone,
    photoUrl: r.photo_url,
  }));
}

export async function fetchFriendRequests(): Promise<FriendRequest[]> {
  const { data, error } = await supabase.rpc("my_friend_requests");
  if (error) throw new Error(error.message);
  return ((data ?? []) as { request_id: string; user_id: string; name: string }[]).map((r) => ({
    requestId: r.request_id,
    userId: r.user_id,
    name: r.name || "Player",
  }));
}

export type FriendRequestResult = "sent" | "already_friends" | "already_pending" | "accepted" | "not_found" | "self";

export async function sendFriendRequest(phone: string): Promise<FriendRequestResult> {
  const { data, error } = await supabase.rpc("send_friend_request", { p_phone: phone });
  if (error) throw new Error(error.message);
  return data as FriendRequestResult;
}

export async function respondFriendRequest(requestId: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc("respond_friend_request", { p_request_id: requestId, p_accept: accept });
  if (error) throw new Error(error.message);
}

/** Android Chrome only (Contact Picker API). Elsewhere callers fall back to typing a number. */
export const contactPickerSupported = () =>
  typeof navigator !== "undefined" && "contacts" in navigator && "ContactsManager" in window;

export async function pickDeviceContacts(): Promise<DeviceContact[]> {
  const nav = navigator as unknown as {
    contacts: { select: (props: string[], opts: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[] }[]> };
  };
  const picked = await nav.contacts.select(["name", "tel"], { multiple: true });
  const out: DeviceContact[] = [];
  const seen = new Set<string>();
  for (const c of picked) {
    const name = c.name?.[0]?.trim() || "Contact";
    for (const t of c.tel ?? []) {
      const p = phone10(t);
      if (p.length === 10 && !seen.has(p)) {
        seen.add(p);
        out.push({ name, phone10: p });
      }
    }
  }
  return out;
}

/** Which of these contacts already have a JustPlay account? */
export async function matchContacts(contacts: DeviceContact[]): Promise<ContactMatch[]> {
  if (contacts.length === 0) return [];
  const { data, error } = await supabase.rpc("match_contacts", { p_phones: contacts.map((c) => c.phone10) });
  if (error) throw new Error(error.message);
  const byPhone = new Map(
    ((data ?? []) as { user_id: string; name: string; phone10: string; is_friend: boolean }[]).map((r) => [r.phone10, r]),
  );
  return contacts.map((c) => {
    const m = byPhone.get(c.phone10);
    return { ...c, userId: m?.user_id ?? null, isFriend: m?.is_friend ?? false, appName: m?.name };
  });
}

export async function invitePlayers(gameId: string, userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const { data, error } = await supabase.rpc("invite_players_to_game", { p_game_id: gameId, p_user_ids: userIds });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export async function removeFriend(userId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_friend", { p_user_id: userId });
  if (error) throw new Error(error.message);
}

/** Ids of everyone the host already invited to this game (RLS: host sees their own invites). */
export async function fetchInvitedIds(gameId: string): Promise<string[]> {
  const { data, error } = await supabase.from("game_invites").select("user_id").eq("game_id", gameId);
  if (error) return [];
  return (data ?? []).map((r) => r.user_id as string);
}
