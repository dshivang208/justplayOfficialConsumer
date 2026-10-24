import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Users } from "lucide-react";
import type { Game } from "@/data/community";
import { perHead } from "@/data/community";
import { daysUntil, gameTimeLabel, relativeDayLabel } from "@/lib/games";
import { Button } from "./Button";
import { SportTag } from "./SportTag";
import { cn } from "@/lib/utils";

export function GameCard({
  game,
  joined,
  requested,
  onJoin,
  onManage,
  className,
  view = "grid",
}: {
  view?: "grid" | "list";
  game: Game;
  joined?: boolean;
  requested?: boolean;
  onJoin?: () => void;
  /** When provided, "Manage" opens the management view immediately (e.g.
   *  a modal right here) instead of navigating to the game's own detail
   *  page first — one click, not two. */
  onManage?: () => void;
  className?: string;
}) {
  const filled = game.players.length;
  const spotsLeft = game.spotsTotal - filled;
  const pct = Math.min(100, Math.round((filled / game.spotsTotal) * 100));
  const price = perHead(game);
  const cancelled = game.status === "cancelled";
  const past = daysUntil(game.dateISO) < 0;

  const action = game.isMine ? (
    onManage ? (
      <Button size="sm" variant="outline" onClick={onManage}>
        Manage
      </Button>
    ) : (
      <Button asChild size="sm" variant="outline">
        <Link to="/games/$gameId" params={{ gameId: game.id }}>
          Manage
        </Link>
      </Button>
    )
  ) : joined ? (
    <Button asChild size="sm" variant="surface">
      <Link to="/games/$gameId" params={{ gameId: game.id }}>
        Joined ✓
      </Link>
    </Button>
  ) : requested ? (
    <Button size="sm" variant="surface" disabled>
      Requested
    </Button>
  ) : (
    <Button size="sm" disabled={spotsLeft === 0 || cancelled || past} onClick={onJoin}>
      {cancelled
        ? "Cancelled"
        : past
          ? "Game over"
          : spotsLeft === 0
            ? "Full"
            : game.joinPolicy === "approval"
              ? "Request to Join"
              : "Join Game"}
    </Button>
  );

  const priceLabel =
    price === 0 ? (
      <span className="text-primary">Free to join</span>
    ) : (
      <>
        ₹{price}
        <span className="text-xs font-medium text-muted-foreground"> / head</span>
      </>
    );

  if (view === "list") {
    return (
      <article
        className={cn(
          "surface-card flex flex-col gap-3 rounded-2xl p-4 transition-colors hover:border-primary/60 sm:flex-row sm:items-center sm:gap-5",
          (cancelled || past) && "opacity-60",
          className,
        )}
      >
        <div className="min-w-0 sm:w-56 sm:shrink-0">
          <div className="flex items-center gap-2">
            <SportTag sport={game.sport} />
            <span className="rounded-lg border border-border px-2 py-0.5 text-[11px] font-semibold text-accent">
              {cancelled ? "Cancelled" : past ? "Game over" : relativeDayLabel(game.dateISO)}
            </span>
          </div>
          <h3 className="mt-2 truncate text-lg leading-tight">
            <Link to="/games/$gameId" params={{ gameId: game.id }} className="hover:text-primary">
              {game.venueName}
            </Link>
          </h3>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {game.area}
          </p>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5 text-sm">
          <p className="inline-flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" /> {gameTimeLabel(game)}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {game.isMine ? "Hosted by you" : `Hosted by ${game.hostName}`}
            </span>{" "}
            · {game.skillLevel === "Any" ? "All levels" : game.skillLevel}
            {game.joinPolicy === "approval" ? " · Approval needed" : ""}
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              {filled}/{game.spotsTotal} joined
            </span>
            <span className={spotsLeft <= 2 ? "font-bold text-accent" : "text-muted-foreground"}>
              {spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"}
            </span>
            <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
              <div className="gradient-primary h-full rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-3 sm:w-44 sm:flex-col sm:items-end sm:justify-center sm:gap-2 sm:border-0 sm:pt-0">
          <span className="text-sm font-bold text-foreground">{priceLabel}</span>
          {action}
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "surface-card flex flex-col gap-3 rounded-2xl p-4 transition-all hover:-translate-y-1 hover:border-primary/60",
        (cancelled || past) && "opacity-60",
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
          {cancelled ? "Cancelled" : past ? "Game over" : relativeDayLabel(game.dateISO)}
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
        <span className="text-sm font-bold text-foreground">{priceLabel}</span>
        {action}
      </div>
    </article>
  );
}
