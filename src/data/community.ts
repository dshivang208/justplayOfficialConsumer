/**
 * Shared types + pure helpers for hosted games, groups and events.
 * Backend Phase E replaced the mock seed arrays that used to live here —
 * real data now comes from Supabase via `useCommunity()` in `lib/community.tsx`.
 */

export type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Any";

export const skillLevels: SkillLevel[] = ["Beginner", "Intermediate", "Advanced", "Any"];

export type Player = {
  id: string;
  name: string;
  initials: string;
  joinedAt?: string;
  photoUrl?: string | null;
};

export type Game = {
  id: string;
  sport: string;
  venueId: string;
  venueName: string;
  area: string;
  dateISO: string;
  startHour: number;
  endHour: number;
  hostId: string;
  hostName: string;
  hostInitials: string;
  spotsTotal: number;
  players: Player[];
  /** Players with a pending approval request — only populated meaningfully
   *  for the host (RLS only returns other users' requested rows to the
   *  host of that game; see game_participants select policy). */
  pendingRequests: Player[];
  skillLevel: SkillLevel;
  costMode: "free" | "split";
  /** Total venue cost, split across spotsTotal when costMode === "split". */
  totalCost: number;
  description: string;
  joinPolicy: "open" | "approval";
  groupId?: string;
  status: "active" | "cancelled";
  isMine?: boolean;
};

export type GameMessage = {
  id: string;
  gameId: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: string;
};

export type Group = {
  id: string;
  name: string;
  sport: string;
  description: string;
  image: string;
  privacy: "Public" | "Private";
  area: string;
  memberCount: number;
  members: Player[];
  /** Pending join requests for this group — only meaningfully populated
   *  when the current user is an admin (RLS only returns other users'
   *  requests to a group admin; see group_join_requests select policy). */
  pendingRequests: Player[];
  isMine?: boolean;
  /** The current user's own membership role in this group, or null if
   *  they aren't a member. Drives whether admin-only controls (approving
   *  join requests) are shown. */
  myRole: "admin" | "member" | null;
};

export type GroupMessage = {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderPhotoUrl: string | null;
  message: string;
  createdAt: string;
};

export type CommunityEventDetail = {
  id: string;
  title: string;
  kind: "Tournament" | "Coaching Camp" | "Meetup";
  sport: string;
  dateISO: string;
  timeLabel: string;
  venueName: string;
  area: string;
  image: string;
  description: string;
  organizerName: string;
  organizerInitials: string;
  organizerAbout: string;
  entryFee: number;
  feeUnit: string;
  capacity: number;
  registered: number;
  ctaType: "register" | "interest";
};

export function initialsOf(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0]!)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function perHead(game: Game) {
  if (game.costMode === "free") return 0;
  return Math.round(game.totalCost / Math.max(game.spotsTotal, 1));
}

/** Bundled placeholder covers, keyed by sport, for groups that haven't set
 *  a cover_photo_url yet (no group-owner image upload in this phase) — same
 *  idea as fetchVenues()'s fallbackImage() in data/venues.ts. Imported by
 *  path here (not the asset modules directly) so this file stays framework
 *  free; callers pass the already-resolved asset URLs in. */
export function fallbackGroupImage(
  sport: string,
  id: string,
  pool: { football: string; cricket: string; badminton: string },
): string {
  const s = sport.toLowerCase();
  if (s.includes("football")) return pool.football;
  if (s.includes("cricket")) return pool.cricket;
  if (s.includes("badminton") || s.includes("tennis") || s.includes("pickleball"))
    return pool.badminton;
  // Deterministic pick for any other sport so the same group always shows
  // the same placeholder instead of a random one on every reload.
  const options = [pool.football, pool.cricket, pool.badminton];
  const idx = Array.from(id).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % options.length;
  return options[idx]!;
}

/** Bundled placeholder covers, keyed by sport, for events that haven't set
 *  an image_url (no event-organizer image upload in this phase). Same
 *  fallback idea as fetchVenues()'s fallbackImage() and
 *  fallbackGroupImage() above — callers pass in the already-resolved
 *  asset URLs so this file stays framework-free. */
export function fallbackEventImage(
  sport: string,
  id: string,
  pool: { tournament: string; football: string; cricket: string; badminton: string },
): string {
  const s = sport.toLowerCase();
  if (s.includes("football")) return pool.football;
  if (s.includes("cricket")) return pool.cricket;
  if (s.includes("badminton") || s.includes("tennis") || s.includes("pickleball"))
    return pool.badminton;
  // Anything else (a general tournament/meetup) gets the generic cover,
  // picked deterministically among the rest for variety if there are many.
  const options = [pool.tournament, pool.football, pool.cricket, pool.badminton];
  const idx = Array.from(id).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % options.length;
  return options[idx]!;
}