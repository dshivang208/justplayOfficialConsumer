import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Users } from "lucide-react";
import type { Game } from "@/data/community";
import { perHead } from "@/data/community";
import { gameTimeLabel, relativeDayLabel } from "@/lib/games";
import { Button } from "./Button";
import { SportTag } from "./SportTag";
import { cn } from "@/lib/utils";

export function GameCard({
  game,
  joined,
  requested,
  onJoin,
  className,
}: {
  game: Game;
  joined?: boolean;
  requested?: boolean;
  onJoin?: () => void;
  className?: string;
}) {
  const filled = game.players.length;
  const spotsLeft = game.spotsTotal - filled;
  const pct = Math.min(100, Math.round((filled / game.spotsTotal) * 100));
  const price = perHead(game);
  const cancelled = game.status === "cancelled";

  return (
    <article
      className={cn(
        "surface-card flex flex-col gap-3 rounded-2xl p-4 transition-all hover:-translate-y-1 hover:border-primary/60",
        cancelled && "opacity-60",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <SportTag sport={game.sport} />
          <h3 className="mt-2 text-lg leading-tight">
            <Link to="/games/$gameId" params={{ gameId: game.id }} className="hover:text-primary">
              {game.venueName}
            </Link>
          </h3>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {game.area}
          </p>
        </div>
        <span className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-accent">
          {cancelled ? "Cancelled" : relativeDayLabel(game.dateISO)}
        </span>
      </div>

      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 text-primary" /> {gameTimeLabel(game)}
      </p>

      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
          {game.hostInitials}
        </span>
        <div className="text-xs">
          <p className="font-semibold text-foreground">
            {game.isMine ? "Hosted by you" : `Hosted by ${game.hostName}`}
          </p>
          <p className="text-muted-foreground">
            {game.skillLevel === "Any" ? "All levels" : game.skillLevel}
            {game.joinPolicy === "approval" ? " · Approval needed" : ""}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
            <Users className="h-3.5 w-3.5 text-primary" />
            {filled}/{game.spotsTotal} joined
          </span>
          <span className={spotsLeft <= 2 ? "font-bold text-accent" : "text-muted-foreground"}>
            {spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="gradient-primary h-full rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm font-bold text-foreground">
          {price === 0 ? (
            <span className="text-primary">Free to join</span>
          ) : (
            <>
              ₹{price}
              <span className="text-xs font-medium text-muted-foreground"> / head</span>
            </>
          )}
        </span>
        {game.isMine ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/games/$gameId" params={{ gameId: game.id }}>Manage</Link>
          </Button>
        ) : joined ? (
          <Button asChild size="sm" variant="surface">
            <Link to="/games/$gameId" params={{ gameId: game.id }}>Joined ✓</Link>
          </Button>
        ) : requested ? (
          <Button size="sm" variant="surface" disabled>
            Requested
          </Button>
        ) : (
          <Button size="sm" disabled={spotsLeft === 0 || cancelled} onClick={onJoin}>
            {cancelled
              ? "Cancelled"
              : spotsLeft === 0
                ? "Full"
                : game.joinPolicy === "approval"
                  ? "Request to Join"
                  : "Join Game"}
          </Button>
        )}
      </div>
    </article>
  );
}
