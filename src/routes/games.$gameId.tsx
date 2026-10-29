import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, CalendarX2, Check, Clock, MapPin, Send, Settings, Trash2, UserPlus, Users } from "lucide-react";
import { PageShell } from "@/components/jp/PageShell";
import { ManageGameModal } from "@/components/jp/ManageGameModal";
import { InviteMoreModal } from "@/components/jp/InviteMoreModal";
import { Button } from "@/components/jp/Button";
import { SportTag } from "@/components/jp/SportTag";
import { perHead, type GameMessage, type GameQuestion } from "@/data/community";
import { fetchVenue } from "@/data/venues";
import { daysUntil, gameTimeLabel, relativeDayLabel } from "@/lib/games";
import { formatDateLong, formatINR } from "@/lib/booking";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

type Search = { new?: boolean };

export const Route = createFileRoute("/games/$gameId")({
  validateSearch: (search: Record<string, unknown>): Search =>
    search["new"] === true ? { new: true } : {},
  head: () => ({
    meta: [
      { title: "Game details | JustPlay" },
      { name: "description", content: "See who's joined and lock your spot for this game." },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-4xl">Game not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been removed or the link is off.
        </p>
        <Button asChild className="mt-6">
          <Link to="/games">Browse games</Link>
        </Button>
      </div>
    </div>
  ),
  component: GameDetailPage,
});

function GameDetailPage() {
  const { gameId } = Route.useParams();
  const { new: justPublished } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const {
    getGame,
    joinedGameIds,
    requestedGameIds,
    waitlistedGameIds,
    joinWaitlist,
    joinGame,
    leaveGame,
    requestJoin,
    cancelGame,
    loading,
  } = useCommunity();

  const [manageOpen, setManageOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const game = getGame(gameId);

  // Venue write-up (about / address) for the "Venue" block.
  const venueId = game?.venueId;
  const [venueInfo, setVenueInfo] = useState<{ about: string; tagline: string; address: string } | null>(null);
  useEffect(() => {
    if (!venueId) return;
    let active = true;
    void fetchVenue(venueId).then((v) => {
      if (active) setVenueInfo(v ? { about: v.about, tagline: v.tagline, address: v.address } : null);
    });
    return () => {
      active = false;
    };
  }, [venueId]);

  if (!game) {
    if (loading) {
      return (
        <PageShell>
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
            Loading game…
          </div>
        </PageShell>
      );
    }
    throw notFound();
  }

  const joined = joinedGameIds.includes(game.id);
  const requested = requestedGameIds.includes(game.id);
  const waitlisted = waitlistedGameIds.includes(game.id);
  const waitPos = game.waitlist.findIndex((p) => p.id === user?.id) + 1;
  const spotsLeft = game.spotsTotal - game.players.length;
  const pct = Math.min(100, Math.round((game.players.length / game.spotsTotal) * 100));
  const price = perHead(game);
  const cancelled = game.status === "cancelled";
  const past = daysUntil(game.dateISO) < 0 || game.status === "completed";

  const handleJoin = async () => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: `/games/${game.id}` } });
      return;
    }
    if (past) return; // button is disabled in this state; belt-and-braces
    try {
      if (game.joinPolicy === "approval") {
        await requestJoin(game.id);
        toast.success("Request sent to the host");
      } else {
        await joinGame(game.id);
        toast.success("You're in! Spot confirmed.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join this game. Try again.");
    }
  };

  const handleWaitlist = async () => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: `/games/${game.id}` } });
      return;
    }
    try {
      const pos = await joinWaitlist(game.id);
      toast.success(`You're #${pos} on the waiting list — we'll notify you if a spot opens.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join the waiting list. Try again.");
    }
  };

  const handleLeave = async () => {
    try {
      await leaveGame(game.id);
      toast.success(waitlisted ? "You've left the waiting list" : "You've left the game");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't leave this game. Try again.");
    }
  };

  const handleCancel = async () => {
    try {
      await cancelGame(game.id);
      toast.success("Game cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't cancel this game. Try again.");
    } finally {
      setConfirmCancel(false);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to="/games"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All games
        </Link>

        {justPublished ? (
          <div className="surface-card mt-4 flex items-center gap-3 rounded-2xl border-primary/40 bg-primary/5 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="h-4.5 w-4.5" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              Game published! It's live in the Hosted Games feed now.
            </p>
          </div>
        ) : null}

        <div className="surface-card mt-4 rounded-2xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SportTag sport={game.sport} />
              <h1 className="mt-3 text-3xl leading-tight sm:text-4xl">{game.venueName}</h1>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {game.area}, Kanpur
              </p>
            </div>
            <span className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-accent">
              {cancelled ? "Cancelled" : past ? "Game over" : relativeDayLabel(game.dateISO)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoRow
              icon={<Clock className="h-4 w-4" />}
              label="Time"
              value={gameTimeLabel(game)}
            />
            <InfoRow
              icon={<Clock className="h-4 w-4" />}
              label="Date"
              value={formatDateLong(game.dateISO)}
            />
            <InfoRow
              icon={<MapPin className="h-4 w-4" />}
              label="Venue"
              value={`${game.venueName}${game.area ? `, ${game.area}` : ""}`}
            />
            <InfoRow label="Hosted by" value={game.isMine ? "You" : game.hostName} />
            <InfoRow
              label="Skill level"
              value={game.skillLevel === "Any" ? "All levels" : game.skillLevel}
            />
            {game.venuePreBooked ? <InfoRow label="Booking" value="Venue already booked by host ✅" /> : null}
            <InfoRow
              label="Joining"
              value={game.joinPolicy === "open" ? "Open to all" : "Approval needed"}
            />
            <InfoRow
              label="Cost"
              value={price === 0 ? "Free to join" : `${formatINR(price)} per head`}
            />
            <InfoRow
              label="Venue page"
              value={
                <Link
                  to="/venues/$venueId"
                  params={{ venueId: game.venueId }}
                  className="text-primary hover:underline"
                >
                  View venue details
                </Link>
              }
            />
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-xl bg-secondary p-3.5">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">About this game</p>
              <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">
                {game.description || "The host hasn't added a description yet — ask them below."}
              </p>
            </div>
            {venueInfo && (venueInfo.about || venueInfo.tagline || venueInfo.address) ? (
              <div className="rounded-xl border border-border p-3.5">
                <p className="text-xs font-bold uppercase tracking-wide text-foreground">About {game.venueName}</p>
                {venueInfo.tagline ? <p className="mt-1.5 text-sm font-semibold text-foreground">{venueInfo.tagline}</p> : null}
                {venueInfo.about ? <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{venueInfo.about}</p> : null}
                {venueInfo.address ? (
                  <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {venueInfo.address}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                {game.players.length}/{game.spotsTotal} joined
              </span>
              <span className={spotsLeft <= 2 ? "font-bold text-accent" : "text-muted-foreground"}>
                {spotsLeft > 0 ? `${spotsLeft} spots left` : game.waitlist.length > 0 ? `Full · ${game.waitlist.length} waiting` : "Full"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="gradient-primary h-full rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <h2 className="mt-6 text-lg">Players ({game.players.length})</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {game.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground">
                  {p.initials}
                </span>
                <span className="text-xs font-semibold">
                  {p.id === game.hostId ? `${p.name} (Host)` : p.name}
                </span>
              </div>
            ))}
          </div>

          {game.isMine && game.waitlist.length > 0 ? (
            <div className="mt-5 rounded-xl border border-border p-3.5">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">
                Waiting list ({game.waitlist.length})
              </p>
              <ol className="mt-2 space-y-1 text-sm">
                {game.waitlist.map((p, i) => (
                  <li key={p.id} className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{i + 1}.</span> {p.name}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                The first person in line joins automatically when a spot opens or you add spots.
              </p>
            </div>
          ) : null}

          {joined && !game.isMine ? <HostMessages gameId={game.id} /> : null}

          {!cancelled ? <GameQuestions gameId={game.id} hostId={game.hostId} /> : null}

          <div className="mt-6 border-t border-border pt-5">
            {game.isMine && past && !cancelled ? (
              <p className="text-center text-sm font-semibold text-muted-foreground">
                This game is over — it's saved in your{" "}
                <Link to="/game-history" className="text-primary hover:underline">
                  game history
                </Link>
                .
              </p>
            ) : game.isMine ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                {!cancelled ? (
                  <Button className="flex-1" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="h-4 w-4" /> Invite players
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setManageOpen(true)}
                  disabled={cancelled}
                >
                  <Settings className="h-4 w-4" /> Manage Game
                </Button>
                {!cancelled ? (
                  <Button
                    variant="ghost"
                    className="flex-1 text-destructive hover:bg-destructive/10"
                    onClick={() => setConfirmCancel(true)}
                  >
                    <CalendarX2 className="h-4 w-4" /> Cancel game
                  </Button>
                ) : null}
              </div>
            ) : cancelled ? (
              <p className="text-center text-sm font-semibold text-destructive">
                This game was cancelled by the host.
              </p>
            ) : past && !requested ? (
              <p className="text-center text-sm font-semibold text-muted-foreground">
                {joined ? "You played this game — " : "This game has already happened. "}
                {joined ? (
                  <Link to="/game-history" className="text-primary hover:underline">
                    see your game history
                  </Link>
                ) : null}
              </p>
            ) : joined ? (
              <Button
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10"
                onClick={handleLeave}
              >
                Leave game
              </Button>
            ) : requested ? (
              <Button className="w-full" variant="surface" disabled>
                Request sent — waiting on host approval
              </Button>
            ) : waitlisted ? (
              <div className="space-y-2">
                <p className="text-center text-sm font-semibold text-foreground">
                  You're #{waitPos || 1} on the waiting list
                </p>
                <Button variant="outline" className="w-full" onClick={handleLeave}>
                  Leave waiting list
                </Button>
              </div>
            ) : spotsLeft <= 0 && game.joinPolicy === "open" && !past ? (
              <Button className="w-full" size="lg" variant="outline" onClick={handleWaitlist}>
                Game full — join waiting list
                {game.waitlist.length > 0 ? ` (${game.waitlist.length} waiting)` : ""}
              </Button>
            ) : (
              <Button
                className="w-full"
                size="lg"
                disabled={spotsLeft === 0 || past}
                onClick={handleJoin}
              >
                {spotsLeft === 0
                  ? "Full — join waitlist soon"
                  : game.joinPolicy === "approval"
                    ? "Request to Join"
                    : "Join Game"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {inviteOpen && game.isMine ? <InviteMoreModal game={game} onClose={() => setInviteOpen(false)} /> : null}

      {manageOpen ? (
        <ManageGameModal
          game={game}
          onClose={() => setManageOpen(false)}
          onRequestCancel={() => {
            setManageOpen(false);
            setConfirmCancel(true);
          }}
        />
      ) : null}

      {confirmCancel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 text-center">
            <h2 className="text-2xl leading-none">Cancel this game?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {game.players.length > 1
                ? `${game.players.length - 1} joined player(s) will be notified.`
                : "No one else has joined yet."}
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmCancel(false)}>
                Keep it
              </Button>
              <Button
                className="flex-1 bg-destructive text-destructive-foreground hover:brightness-110"
                onClick={handleCancel}
              >
                Cancel game
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}

function InfoRow({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-3.5 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

/** Read-only view of the host's broadcast messages, for a joined
 *  non-host player. Subscribes to game_messages so a new message from the
 *  host shows up live without a manual refresh. */
function HostMessages({ gameId }: { gameId: string }) {
  const { fetchGameMessages } = useCommunity();
  const [messages, setMessages] = useState<GameMessage[]>([]);

  useEffect(() => {
    let active = true;
    fetchGameMessages(gameId).then((msgs) => {
      if (active) setMessages(msgs);
    });

    const channel = supabase
      .channel(`game-messages-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_messages",
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          void fetchGameMessages(gameId).then((msgs) => {
            if (active) setMessages(msgs);
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [gameId, fetchGameMessages]);

  if (messages.length === 0) return null;

  return (
    <div className="mt-5 rounded-xl border border-border bg-secondary p-3.5">
      <p className="text-xs font-bold text-foreground">Messages from the host</p>
      <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className="text-xs">
            <span className="font-semibold text-foreground">{m.senderName}: </span>
            <span className="text-muted-foreground">{m.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GameQuestions({ gameId, hostId }: { gameId: string; hostId: string }) {
  const { fetchGameQuestions, postGameQuestion, deleteGameQuestion } = useCommunity();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<GameQuestion[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchGameQuestions(gameId)
        .then((q) => active && setItems(q))
        .catch(() => undefined);
    void load();
    const channel = supabase
      .channel(`game-questions-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_questions", filter: `game_id=eq.${gameId}` }, () => void load())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [gameId, fetchGameQuestions]);

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: `/games/${gameId}` } });
      return;
    }
    setBusy(true);
    try {
      await postGameQuestion(gameId, msg);
      setText("");
      setItems(await fetchGameQuestions(gameId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send your message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-border p-3.5">
      <p className="text-xs font-bold uppercase tracking-wide text-foreground">Questions &amp; chat</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Ask the host or other players anything about this game.</p>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No messages yet — be the first to ask.</p>
      ) : (
        <ul className="mt-3 max-h-72 space-y-2.5 overflow-y-auto pr-1">
          {items.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <li key={m.id} className={`flex gap-2 ${mine ? "justify-end" : ""}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary/10" : "bg-secondary"}`}>
                  <p className="text-[11px] font-bold text-foreground">
                    {mine ? "You" : m.senderName}
                    {m.senderId === hostId ? <span className="ml-1 rounded bg-primary/15 px-1 text-primary">Host</span> : null}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line break-words text-muted-foreground">{m.message}</p>
                </div>
                {mine || user?.id === hostId ? (
                  <button
                    type="button"
                    aria-label="Delete message"
                    onClick={() => void deleteGameQuestion(m.id).then(() => setItems((p) => p.filter((x) => x.id !== m.id))).catch(() => undefined)}
                    className="self-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={isAuthenticated ? "Ask a question…" : "Log in to ask a question"}
          className="min-h-10 flex-1 resize-none rounded-2xl border border-border bg-surface px-3.5 py-2 text-sm outline-none focus:border-primary"
        />
        <Button size="sm" onClick={() => void send()} disabled={busy || text.trim().length === 0} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
