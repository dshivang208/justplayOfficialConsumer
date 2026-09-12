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
  fallbackGroupImage,
  fallbackEventImage,
  type CommunityEventDetail,
  type Game,
  type GameMessage,
  type Group,
  type GroupMessage,
  type Player,
  type SkillLevel,
} from "@/data/community";
import { useAuth } from "./auth";
import { supabase } from "./supabaseClient";
import groupFootball from "@/assets/group-football.jpg";
import groupCricket from "@/assets/group-cricket.jpg";
import groupBadminton from "@/assets/group-badminton.jpg";
import eventTournament from "@/assets/event-tournament.jpg";

const groupImagePool = {
  football: groupFootball,
  cricket: groupCricket,
  badminton: groupBadminton,
};

const eventImagePool = {
  tournament: eventTournament,
  football: groupFootball,
  cricket: groupCricket,
  badminton: groupBadminton,
};

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
  approveRequest: (gameId: string, userId: string) => Promise<void>;
  rejectRequest: (gameId: string, userId: string) => Promise<void>;
  removeParticipant: (gameId: string, userId: string) => Promise<void>;
  updateGameDetails: (gameId: string, patch: UpdateGameInput) => Promise<void>;
  fetchGameMessages: (gameId: string) => Promise<GameMessage[]>;
  sendGameMessage: (gameId: string, message: string) => Promise<GameMessage>;
  joinGroup: (id: string) => Promise<"joined" | "pending">;
  leaveGroup: (id: string) => Promise<void>;
  approveGroupJoinRequest: (groupId: string, userId: string) => Promise<void>;
  rejectGroupJoinRequest: (groupId: string, userId: string) => Promise<void>;
  fetchGroupMessages: (groupId: string) => Promise<GroupMessage[]>;
  sendGroupMessage: (groupId: string, message: string) => Promise<GroupMessage>;
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

export type UpdateGameInput = Partial<{
  dateISO: string;
  startHour: number;
  endHour: number;
  spotsTotal: number;
  skillLevel: Game["skillLevel"];
  description: string;
}>;

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

type ProfileMap = Record<string, { name: string; initials: string; photoUrl: string | null }>;

async function fetchProfiles(ids: string[]): Promise<ProfileMap> {
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return {};
  // public_profiles is a view exposing ONLY id, name, profile_photo_url —
  // it has no phone column at all, so no query against it can ever return
  // a phone number for anyone, including other users. Never query
  // public.users directly for another user's info; RLS blocks that to a
  // single row anyway ("users select own"), but this view is the actual
  // mechanism the rest of the app relies on for that guarantee.
  const { data, error } = await supabase
    .from("public_profiles")
    .select("id, name, profile_photo_url")
    .in("id", unique);
  if (error) {
    console.error("fetchProfiles failed:", error.message);
    return {};
  }
  const map: ProfileMap = {};
  for (const row of data ?? []) {
    const name = row.name || "Player";
    map[row.id] = { name, initials: initialsOf(name), photoUrl: row.profile_photo_url };
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
          .select("game_id, user_id, status, joined_at")
          .in("game_id", gameIds)
      : {
          data: [] as { game_id: string; user_id: string; status: string; joined_at: string }[],
        };

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
          joinedAt: p.joined_at,
        }));

      const pendingRequests = (participantRows ?? [])
        .filter((p) => p.game_id === row.id && p.status === "requested")
        .map((p): Player => ({
          id: p.user_id,
          name: profiles[p.user_id]?.name ?? "Player",
          initials: profiles[p.user_id]?.initials ?? "PL",
          joinedAt: p.joined_at,
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
        pendingRequests,
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
      ? await supabase
          .from("group_members")
          .select("group_id, user_id, role, joined_at")
          .in("group_id", groupIds)
      : {
          data: [] as { group_id: string; user_id: string; role: string; joined_at: string }[],
        };

    // RLS on group_join_requests only returns a user's own request, or —
    // for a group they admin — every request for that group. So this
    // select naturally comes back scoped correctly per viewer with no
    // extra filtering needed here.
    const { data: requestRows } = groupIds.length
      ? await supabase
          .from("group_join_requests")
          .select("group_id, user_id, requested_at")
          .in("group_id", groupIds)
      : { data: [] as { group_id: string; user_id: string; requested_at: string }[] };

    const profiles = await fetchProfiles([
      ...(memberRows ?? []).map((m) => m.user_id),
      ...(requestRows ?? []).map((r) => r.user_id),
    ]);

    const mine: string[] = [];

    const mapped: Group[] = (rows ?? []).map((row) => {
      const members: Player[] = (memberRows ?? [])
        .filter((m) => m.group_id === row.id)
        .slice(0, 24)
        .map((m) => ({
          id: m.user_id,
          name: profiles[m.user_id]?.name ?? "Member",
          initials: profiles[m.user_id]?.initials ?? "ME",
          photoUrl: profiles[m.user_id]?.photoUrl ?? null,
          joinedAt: m.joined_at,
        }));

      const pendingRequests: Player[] = (requestRows ?? [])
        .filter((r) => r.group_id === row.id)
        .map((r) => ({
          id: r.user_id,
          name: profiles[r.user_id]?.name ?? "Player",
          initials: profiles[r.user_id]?.initials ?? "PL",
          photoUrl: profiles[r.user_id]?.photoUrl ?? null,
          joinedAt: r.requested_at,
        }));

      const myMembership = user
        ? (memberRows ?? []).find((m) => m.group_id === row.id && m.user_id === user.id)
        : undefined;
      if (myMembership) mine.push(row.id);

      return {
        id: row.id,
        name: row.name,
        sport: row.sport,
        description: row.description ?? "",
        image: row.cover_photo_url || fallbackGroupImage(row.sport, row.id, groupImagePool),
        privacy: row.privacy === "private" ? "Private" : "Public",
        area: row.area ?? "",
        memberCount: row.member_count,
        members,
        pendingRequests,
        isMine: user ? row.created_by === user.id : false,
        myRole: myMembership ? (myMembership.role === "admin" ? "admin" : "member") : null,
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
      ? await supabase.from("event_registrations").select("event_id").eq("user_id", user.id)
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
        image: row.image_url || fallbackEventImage(row.sport, row.id, eventImagePool),
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

  // Live, n-to-n sync: when ANY player joins/leaves/gets removed, or a host
  // cancels a game, every other browser currently looking at that game or
  // the games list picks it up automatically — no manual refresh needed.
  // Requires `hosted_games` and `game_participants` to be added to the
  // `supabase_realtime` publication (see the realtime migration).
  useEffect(() => {
    const channel = supabase
      .channel("hosted-games-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "hosted_games" }, () => {
        void loadGames();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "game_participants" }, () => {
        void loadGames();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadGames]);

  const hostGame = useCallback(
    async (input: HostGameInput) => {
      const { data, error } = await supabase.rpc("create_hosted_game", {
        p_venue_id: input.venueId,
        p_sport: input.sport,
        p_date: input.dateISO,
        p_time: timeLabel(input.startHour, input.endHour),
        p_total_spots: input.spotsTotal,
        p_skill_level: input.skillLevel,
        p_cost_type: input.costMode,
        p_total_cost: input.totalCost,
        p_description: input.description,
        p_join_policy: input.joinPolicy,
      });
      if (error) throw new Error(error.message);

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
        pendingRequests: [],
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

  const approveRequest = useCallback(
    async (gameId: string, userId: string) => {
      const { error } = await supabase.rpc("approve_join_request", {
        p_game_id: gameId,
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
      await loadGames();
    },
    [loadGames],
  );

  const rejectRequest = useCallback(
    async (gameId: string, userId: string) => {
      const { error } = await supabase.rpc("reject_join_request", {
        p_game_id: gameId,
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
      await loadGames();
    },
    [loadGames],
  );

  const removeParticipant = useCallback(
    async (gameId: string, userId: string) => {
      const { error } = await supabase.rpc("remove_game_participant", {
        p_game_id: gameId,
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
      await loadGames();
    },
    [loadGames],
  );

  const updateGameDetails = useCallback(
    async (gameId: string, patch: UpdateGameInput) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.dateISO !== undefined) dbPatch["date"] = patch.dateISO;
      if (patch.startHour !== undefined && patch.endHour !== undefined) {
        dbPatch["time"] = timeLabel(patch.startHour, patch.endHour);
      }
      if (patch.spotsTotal !== undefined) dbPatch["total_spots"] = patch.spotsTotal;
      if (patch.skillLevel !== undefined) dbPatch["skill_level"] = patch.skillLevel;
      if (patch.description !== undefined) dbPatch["description"] = patch.description;

      // RLS ("hosted_games update own fields") + the column-scoped grant
      // already restrict this to the game's own host — see
      // 20260829010000_phase_cdef_backend.sql.
      const { error } = await supabase.from("hosted_games").update(dbPatch).eq("id", gameId);
      if (error) throw new Error(error.message);
      await loadGames();
    },
    [loadGames],
  );

  const fetchGameMessages = useCallback(async (gameId: string): Promise<GameMessage[]> => {
    const { data, error } = await supabase
      .from("game_messages")
      .select("id, game_id, sender_id, message, created_at")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const senderIds = [...new Set((data ?? []).map((r) => r.sender_id))];
    const profiles = await fetchProfiles(senderIds);

    return (data ?? []).map((r) => ({
      id: r.id,
      gameId: r.game_id,
      senderId: r.sender_id,
      senderName: profiles[r.sender_id]?.name ?? "Host",
      message: r.message,
      createdAt: r.created_at,
    }));
  }, []);

  const sendGameMessage = useCallback(
    async (gameId: string, message: string): Promise<GameMessage> => {
      const { data, error } = await supabase.rpc("send_game_message", {
        p_game_id: gameId,
        p_message: message,
      });
      if (error) throw new Error(error.message);
      return {
        id: data.id,
        gameId: data.game_id,
        senderId: data.sender_id,
        senderName: user?.name ?? "Host",
        message: data.message,
        createdAt: data.created_at,
      };
    },
    [user],
  );

  const joinGroup = useCallback(
    async (id: string): Promise<"joined" | "pending"> => {
      const { data, error } = await supabase.rpc("join_group", { p_group_id: id });
      if (error) throw new Error(error.message);
      await loadGroups();
      return (data?.status as "joined" | "pending") ?? "joined";
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

  const approveGroupJoinRequest = useCallback(
    async (groupId: string, userId: string) => {
      const { error } = await supabase.rpc("approve_group_join_request", {
        p_group_id: groupId,
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
      await loadGroups();
    },
    [loadGroups],
  );

  const rejectGroupJoinRequest = useCallback(
    async (groupId: string, userId: string) => {
      const { error } = await supabase.rpc("reject_group_join_request", {
        p_group_id: groupId,
        p_user_id: userId,
      });
      if (error) throw new Error(error.message);
      await loadGroups();
    },
    [loadGroups],
  );

  const fetchGroupMessages = useCallback(async (groupId: string): Promise<GroupMessage[]> => {
    const { data, error } = await supabase
      .from("group_messages")
      .select("id, group_id, sender_user_id, message_text, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const senderIds = [...new Set((data ?? []).map((r) => r.sender_user_id))];
    const profiles = await fetchProfiles(senderIds);

    return (data ?? []).map((r) => ({
      id: r.id,
      groupId: r.group_id,
      senderId: r.sender_user_id,
      senderName: profiles[r.sender_user_id]?.name ?? "Member",
      senderPhotoUrl: profiles[r.sender_user_id]?.photoUrl ?? null,
      message: r.message_text,
      createdAt: r.created_at,
    }));
  }, []);

  const sendGroupMessage = useCallback(
    async (groupId: string, message: string): Promise<GroupMessage> => {
      const { data, error } = await supabase.rpc("send_group_message", {
        p_group_id: groupId,
        p_message: message,
      });
      if (error) throw new Error(error.message);
      return {
        id: data.id,
        groupId: data.group_id,
        senderId: data.sender_user_id,
        senderName: user?.name ?? "Member",
        senderPhotoUrl: user?.avatar ?? null,
        message: data.message_text,
        createdAt: data.created_at,
      };
    },
    [user],
  );

  const createGroup = useCallback(
    async (input: CreateGroupInput) => {
      const { data, error } = await supabase.rpc("create_group", {
        p_name: input.name,
        p_sport: input.sport,
        p_description: input.description,
        p_area: input.area,
        p_privacy: input.privacy.toLowerCase(),
        p_cover_photo_url: input.image,
      });
      if (error) throw new Error(error.message);

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
      approveRequest,
      rejectRequest,
      removeParticipant,
      updateGameDetails,
      fetchGameMessages,
      sendGameMessage,
      joinGroup,
      leaveGroup,
      approveGroupJoinRequest,
      rejectGroupJoinRequest,
      fetchGroupMessages,
      sendGroupMessage,
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
      approveRequest,
      rejectRequest,
      removeParticipant,
      updateGameDetails,
      fetchGameMessages,
      sendGameMessage,
      joinGroup,
      leaveGroup,
      approveGroupJoinRequest,
      rejectGroupJoinRequest,
      fetchGroupMessages,
      sendGroupMessage,
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