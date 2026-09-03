/**
 * Backend Phase E — hosted games, groups, events, backed by real Supabase
 * tables and the atomic join/leave/register RPCs from the Phase C/D/E/F
 * migration (`join_hosted_game`, `leave_hosted_game`, `join_group`,
 * `leave_group`, `register_for_event`, `unregister_from_event`,
 * `cancel_hosted_game`). Every mutation calls the RPC, then re-fetches —
 * simple and always consistent with the server, which is what actually
 * matters once counters can only move through those functions.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  initialsOf,
  type CommunityEventDetail,
  type Game,
  type Group,
  type Player,
  type SkillLevel,
} from "@/data/community";
import { useAuth } from "./auth";
import { supabase } from "./supabaseClient";

type CommunityContextValue = {
  games: Game[];
  groups: Group[];
  events: CommunityEventDetail[];
  joinedGameIds: string[];
  requestedGameIds: string[];
  joinedGroupIds: string[];
  registeredEventIds: string[];
  hydrated: boolean;
  loading: boolean;
  getGame: (id: string) => Game | undefined;
  getGroup: (id: string) => Group | undefined;
  getEvent: (id: string) => CommunityEventDetail | undefined;
  hostGame: (input: HostGameInput) => Promise<Game>;
  cancelGame: (id: string) => Promise<void>;
  joinGame: (id: string) => Promise<void>;
  leaveGame: (id: string) => Promise<void>;
  requestJoin: (id: string) => Promise<void>;
  joinGroup: (id: string) => Promise<void>;
  leaveGroup: (id: string) => Promise<void>;
  createGroup: (input: CreateGroupInput) => Promise<Group>;
  registerEvent: (id: string) => Promise<void>;
  unregisterEvent: (id: string) => Promise<void>;
  myGames: Game[];
  myGroups: Group[];
  gamesForGroup: (groupId: string) => Game[];
  refresh: () => Promise<void>;
};

export type HostGameInput = {
  sport: string;
  venueId: string;
  venueName: string;
  area: string;
  dateISO: string;
  startHour: number;
  endHour: number;
  spotsTotal: number;
  skillLevel: Game["skillLevel"];
  costMode: Game["costMode"];
  totalCost: number;
  description: string;
  joinPolicy: Game["joinPolicy"];
};

export type CreateGroupInput = {
  name: string;
  sport: string;
  description: string;
  area: string;
  privacy: Group["privacy"];
  image: string;
};

const CommunityContext = createContext<CommunityContextValue | null>(null);

function fmtHour(h: number) {
  const hour = h % 24;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

function timeLabel(startHour: number, endHour: number) {
  return `${fmtHour(startHour)} – ${fmtHour(endHour)}`;
}

function parseHourRange(label: string): { startHour: number; endHour: number } {
  const [startPart, endPart] = label.split("–").map((s) => s.trim());
  const parse = (s?: string) => {
    if (!s) return 0;
    const m = /^(\d{1,2}):00\s*(AM|PM)$/i.exec(s);
    if (!m) return 0;
    let h = Number(m[1]) % 12;
    if (m[2]!.toUpperCase() === "PM") h += 12;
    return h;
  };
  return { startHour: parse(startPart), endHour: parse(endPart) };
}

type ProfileMap = Record<string, { name: string; initials: string }>;

async function fetchProfiles(ids: string[]): Promise<ProfileMap> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return {};
  const { data, error } = await supabase.from("public_profiles").select("id, name").in("id", unique);
  if (error) {
    console.error("fetchProfiles failed:", error.message);
    return {};
  }
  const map: ProfileMap = {};
  for (const row of data ?? []) {
    const name = row.name || "Player";
    map[row.id] = { name, initials: initialsOf(name) };
  }
  return map;
}

export function CommunityProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [games, setGames] = useState<Game[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<CommunityEventDetail[]>([]);
  const [joinedGameIds, setJoinedGameIds] = useState<string[]>([]);
  const [requestedGameIds, setRequestedGameIds] = useState<string[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<string[]>([]);
  const [registeredEventIds, setRegisteredEventIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from("hosted_games")
      .select("*, venues(name, area)")
      .order("date", { ascending: true });
    if (error) {
      console.error("load hosted_games failed:", error.message);
      return;
    }
    const gameIds = (rows ?? []).map((r) => r.id);
    const { data: participantRows } = gameIds.length
      ? await supabase
          .from("game_participants")
          .select("game_id, user_id, status")
          .in("game_id", gameIds)
      : { data: [] as { game_id: string; user_id: string; status: string }[] };

    const profileIds = [
      ...(rows ?? []).map((r) => r.host_user_id),
      ...(participantRows ?? []).map((p) => p.user_id),
    ];
    const profiles = await fetchProfiles(profileIds);

    const mine: string[] = [];
    const requested: string[] = [];

    const mapped: Game[] = (rows ?? []).map((row: any) => {
      const { startHour, endHour } = parseHourRange(row.time);
      const joinedPlayers = (participantRows ?? [])
        .filter((p) => p.game_id === row.id && p.status === "joined")
        .map((p): Player => ({
          id: p.user_id,
          name: profiles[p.user_id]?.name ?? "Player",
          initials: profiles[p.user_id]?.initials ?? "PL",
        }));

      if (user) {
        const mineRow = (participantRows ?? []).find(
          (p) => p.game_id === row.id && p.user_id === user.id,
        );
        if (mineRow?.status === "joined") mine.push(row.id);
        if (mineRow?.status === "requested") requested.push(row.id);
      }

      return {
        id: row.id,
        sport: row.sport,
        venueId: row.venue_id,
        venueName: row.venues?.name ?? "Venue",
        area: row.venues?.area ?? "",
        dateISO: row.date,
        startHour,
        endHour,
        hostId: row.host_user_id,
        hostName: profiles[row.host_user_id]?.name ?? "Host",
        hostInitials: profiles[row.host_user_id]?.initials ?? "HO",
        spotsTotal: row.total_spots,
        players: joinedPlayers,
        skillLevel: row.skill_level as SkillLevel,
        costMode: row.cost_type,
        totalCost: row.total_cost ?? 0,
        description: row.description ?? "",
        joinPolicy: row.join_policy,
        groupId: row.group_id ?? undefined,
        status: row.status,
        isMine: user ? row.host_user_id === user.id : false,
      };
    });

    setGames(mapped);
    setJoinedGameIds(mine);
    setRequestedGameIds(requested);
  }, [user]);

  const loadGroups = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from("groups")
      .select("*")
      .order("member_count", { ascending: false });
    if (error) {
      console.error("load groups failed:", error.message);
      return;
    }
    const groupIds = (rows ?? []).map((r) => r.id);
    const { data: memberRows } = groupIds.length
      ? await supabase.from("group_members").select("group_id, user_id").in("group_id", groupIds)
      : { data: [] as { group_id: string; user_id: string }[] };

    const profiles = await fetchProfiles((memberRows ?? []).map((m) => m.user_id));

    const mine: string[] = [];

    const mapped: Group[] = (rows ?? []).map((row) => {
      const members: Player[] = (memberRows ?? [])
        .filter((m) => m.group_id === row.id)
        .slice(0, 24)
        .map((m) => ({
          id: m.user_id,
          name: profiles[m.user_id]?.name ?? "Member",
          initials: profiles[m.user_id]?.initials ?? "ME",
        }));

      if (user && (memberRows ?? []).some((m) => m.group_id === row.id && m.user_id === user.id)) {
        mine.push(row.id);
      }

      return {
        id: row.id,
        name: row.name,
        sport: row.sport,
        description: row.description ?? "",
        image: row.cover_photo_url ?? "",
        privacy: row.privacy === "private" ? "Private" : "Public",
        area: row.area ?? "",
        memberCount: row.member_count,
        members,
        isMine: user ? row.created_by === user.id : false,
      };
    });

    setGroups(mapped);
    setJoinedGroupIds(mine);
  }, [user]);

  const loadEvents = useCallback(async () => {
    const { data: rows, error } = await supabase
      .from("events")
      .select("*, venues(name, area)")
      .order("date", { ascending: true });
    if (error) {
      console.error("load events failed:", error.message);
      return;
    }

    const { data: regRows } = user
      ? await supabase.from("event_registrations").select("event_id")
      : { data: [] as { event_id: string }[] };

    const mapped: CommunityEventDetail[] = (rows ?? []).map((row: any) => {
      const organizer = row.organizer_info ?? {};
      return {
        id: row.id,
        title: row.title,
        kind: row.kind,
        sport: row.sport,
        dateISO: row.date,
        timeLabel: row.time_label ?? "",
        venueName: row.venues?.name ?? "TBA",
        area: row.venues?.area ?? "",
        image: row.image_url ?? "",
        description: row.description ?? "",
        organizerName: organizer.name ?? "JustPlay",
        organizerInitials: initialsOf(organizer.name ?? "JustPlay"),
        organizerAbout: organizer.about ?? "",
        entryFee: row.entry_fee,
        feeUnit: row.fee_unit ?? "entry fee",
        capacity: row.participant_limit,
        registered: row.participant_count,
        ctaType: row.cta_type,
      };
    });

    setEvents(mapped);
    setRegisteredEventIds((regRows ?? []).map((r) => r.event_id));
  }, [user]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadGames(), loadGroups(), loadEvents()]);
    setLoading(false);
    setHydrated(true);
  }, [loadGames, loadGroups, loadEvents]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const hostGame = useCallback(
    async (input: HostGameInput) => {
      const { data, error } = await supabase
        .from("hosted_games")
        .insert({
          host_user_id: user!.id,
          venue_id: input.venueId,
          sport: input.sport,
          date: input.dateISO,
          time: timeLabel(input.startHour, input.endHour),
          total_spots: input.spotsTotal,
          spots_filled: 1,
          skill_level: input.skillLevel,
          cost_type: input.costMode,
          total_cost: input.totalCost,
          description: input.description,
          join_policy: input.joinPolicy,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      // Host counts as the first joined player.
      await supabase.from("game_participants").insert({
        game_id: data.id,
        user_id: user!.id,
        status: "joined",
      });

      await loadGames();

      return {
        id: data.id,
        sport: input.sport,
        venueId: input.venueId,
        venueName: input.venueName,
        area: input.area,
        dateISO: input.dateISO,
        startHour: input.startHour,
        endHour: input.endHour,
        hostId: user!.id,
        hostName: user!.name,
        hostInitials: initialsOf(user!.name || "Host"),
        spotsTotal: input.spotsTotal,
        players: [{ id: user!.id, name: user!.name, initials: initialsOf(user!.name || "Host") }],
        skillLevel: input.skillLevel,
        costMode: input.costMode,
        totalCost: input.totalCost,
        description: input.description,
        joinPolicy: input.joinPolicy,
        status: "active",
        isMine: true,
      } as Game;
    },
    [user, loadGames],
  );

  const cancelGame = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("cancel_hosted_game", { p_game_id: id });
      if (error) throw new Error(error.message);
      await loadGames();
    },
    [loadGames],
  );

  const joinGame = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("join_hosted_game", { p_game_id: id });
      if (error) throw new Error(error.message);
      await loadGames();
    },
    [loadGames],
  );

  const leaveGame = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("leave_hosted_game", { p_game_id: id });
      if (error) throw new Error(error.message);
      await loadGames();
    },
    [loadGames],
  );

  // join_hosted_game itself decides open-join vs request-to-join based on
  // the game's join_policy — both call sites use the same RPC.
  const requestJoin = joinGame;

  const joinGroup = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("join_group", { p_group_id: id });
      if (error) throw new Error(error.message);
      await loadGroups();
    },
    [loadGroups],
  );

  const leaveGroup = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("leave_group", { p_group_id: id });
      if (error) throw new Error(error.message);
      await loadGroups();
    },
    [loadGroups],
  );

  const createGroup = useCallback(
    async (input: CreateGroupInput) => {
      const { data, error } = await supabase
        .from("groups")
        .insert({
          name: input.name,
          sport: input.sport,
          description: input.description,
          cover_photo_url: input.image,
          privacy: input.privacy.toLowerCase(),
          area: input.area,
          created_by: user!.id,
          member_count: 1,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      await supabase.from("group_members").insert({
        group_id: data.id,
        user_id: user!.id,
        role: "admin",
      });

      await loadGroups();

      return {
        id: data.id,
        name: input.name,
        sport: input.sport,
        description: input.description,
        image: input.image,
        privacy: input.privacy,
        area: input.area,
        memberCount: 1,
        members: [{ id: user!.id, name: user!.name, initials: initialsOf(user!.name || "You") }],
        isMine: true,
      } as Group;
    },
    [user, loadGroups],
  );

  const registerEvent = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("register_for_event", { p_event_id: id });
      if (error) throw new Error(error.message);
      await loadEvents();
    },
    [loadEvents],
  );

  const unregisterEvent = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("unregister_from_event", { p_event_id: id });
      if (error) throw new Error(error.message);
      await loadEvents();
    },
    [loadEvents],
  );

  const value = useMemo<CommunityContextValue>(
    () => ({
      games,
      groups,
      events,
      joinedGameIds,
      requestedGameIds,
      joinedGroupIds,
      registeredEventIds,
      hydrated,
      loading,
      getGame: (id) => games.find((g) => g.id === id),
      getGroup: (id) => groups.find((g) => g.id === id),
      getEvent: (id) => events.find((e) => e.id === id),
      hostGame,
      cancelGame,
      joinGame,
      leaveGame,
      requestJoin,
      joinGroup,
      leaveGroup,
      createGroup,
      registerEvent,
      unregisterEvent,
      myGames: games.filter((g) => g.isMine),
      myGroups: groups.filter((g) => joinedGroupIds.includes(g.id)),
      gamesForGroup: (groupId) =>
        games.filter((g) => g.groupId === groupId && g.status === "active"),
      refresh,
    }),
    [
      games,
      groups,
      events,
      joinedGameIds,
      requestedGameIds,
      joinedGroupIds,
      registeredEventIds,
      hydrated,
      loading,
      hostGame,
      cancelGame,
      joinGame,
      leaveGame,
      requestJoin,
      joinGroup,
      leaveGroup,
      createGroup,
      registerEvent,
      unregisterEvent,
      refresh,
    ],
  );

  return <CommunityContext.Provider value={value}>{children}</CommunityContext.Provider>;
}

export function useCommunity() {
  const ctx = useContext(CommunityContext);
  if (!ctx) throw new Error("useCommunity must be used inside <CommunityProvider>");
  return ctx;
}

export { perHead } from "@/data/community";