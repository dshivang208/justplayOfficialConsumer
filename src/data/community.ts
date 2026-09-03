/**
 * Shared types + pure helpers for hosted games, groups and events.
 * Backend Phase E replaced the mock seed arrays that used to live here —
 * real data now comes from Supabase via `useCommunity()` in `lib/community.tsx`.
 */

export type SkillLevel = "Beginner" | "Intermediate" | "Advanced" | "Any";

export const skillLevels: SkillLevel[] = ["Beginner", "Intermediate", "Advanced", "Any"];

export type Player = { id: string; name: string; initials: string };

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
  isMine?: boolean;
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