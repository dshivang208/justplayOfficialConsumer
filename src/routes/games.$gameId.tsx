import { useState, type ReactNode } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarX2, Check, Clock, MapPin, MessageCircle, Users } from "lucide-react";
import { PageShell } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { SportTag } from "@/components/jp/SportTag";
import { perHead } from "@/data/community";
import { gameTimeLabel, relativeDayLabel } from "@/lib/games";
import { formatDateLong, formatINR } from "@/lib/booking";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";

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
  const { isAuthenticated } = useAuth();
  const { getGame, joinedGameIds, requestedGameIds, joinGame, leaveGame, requestJoin, cancelGame, loading } =
    useCommunity();

  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const game = getGame(gameId);
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
  const spotsLeft = game.spotsTotal - game.players.length;
  const pct = Math.min(100, Math.round((game.players.length / game.spotsTotal) * 100));
  const price = perHead(game);
  const cancelled = game.status === "cancelled";

  const handleJoin = () => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: `/games/${game.id}` } });
      return;
    }
    if (game.joinPolicy === "approval") requestJoin(game.id);
    else joinGame(game.id);
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
              {cancelled ? "Cancelled" : relativeDayLabel(game.dateISO)}
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
              label="Skill level"
              value={game.skillLevel === "Any" ? "All levels" : game.skillLevel}
            />
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

          {game.description ? (
            <p className="mt-5 rounded-xl bg-secondary p-3.5 text-sm text-muted-foreground">
              {game.description}
            </p>
          ) : null}

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                {game.players.length}/{game.spotsTotal} joined
              </span>
              <span className={spotsLeft <= 2 ? "font-bold text-accent" : "text-muted-foreground"}>
                {spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="gradient-primary h-full rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
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

          <div className="mt-6 border-t border-border pt-5">
            {game.isMine ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMessageOpen(true)}
                  disabled={cancelled}
                >
                  <MessageCircle className="h-4 w-4" /> Message players
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
            ) : joined ? (
              <Button
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10"
                onClick={() => leaveGame(game.id)}
              >
                Leave game
              </Button>
            ) : requested ? (
              <Button className="w-full" variant="surface" disabled>
                Request sent — waiting on host approval
              </Button>
            ) : (
              <Button className="w-full" size="lg" disabled={spotsLeft === 0} onClick={handleJoin}>
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

      {messageOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl border border-border bg-background p-5 sm:rounded-3xl">
            <h2 className="text-2xl leading-none">Message joined players</h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Sent to all {game.players.length} players in this game. Chat history isn't saved yet —
              this is a preview of what's coming.
            </p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Reminder: bring your own racket…"
              className="mt-4 w-full rounded-2xl border border-border bg-surface p-4 text-sm outline-none focus:border-primary"
            />
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setMessageOpen(false);
                  setMessage("");
                  setSent(false);
                }}
              >
                Close
              </Button>
              <Button
                className="flex-1"
                disabled={!message.trim()}
                onClick={() => {
                  setSent(true);
                  setMessage("");
                  setTimeout(() => setMessageOpen(false), 900);
                }}
              >
                {sent ? <Check className="h-4 w-4" /> : null}
                {sent ? "Sent" : "Send"}
              </Button>
            </div>
          </div>
        </div>
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
                onClick={() => {
                  cancelGame(game.id);
                  setConfirmCancel(false);
                }}
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