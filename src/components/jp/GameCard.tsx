import { Link, useNavigate } from "@tanstack/react-router";
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
  waitlisted,
  onJoin,
  onManage,
  className,
  view = "grid",
}: {
  view?: "grid" | "list" | "compact";
  game: Game;
  joined?: boolean;
  requested?: boolean;
  waitlisted?: boolean;
  /** Also used for "Join Waitlist" when a joinable game is full. */
  onJoin?: () => void;
  /** When provided, "Manage" opens the management view immediately (e.g.
   *  a modal right here) instead of navigating to the game's own detail
   *  page first — one click, not two. */
  onManage?: () => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const openDetails = () => void navigate({ to: "/games/$gameId", params: { gameId: game.id } });
  // Whole card opens the game; real buttons/links inside keep doing their own thing.
  const cardProps = {
    role: "link" as const,
    tabIndex: 0,
    "aria-label": `View details: ${game.sport} at ${game.venueName}`,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest("a, button")) return;
      openDetails();
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        openDetails();
      }
    },
  };
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
  ) : waitlisted ? (
    <Button asChild size="sm" variant="surface">
      <Link to="/games/$gameId" params={{ gameId: game.id }}>
        On waitlist
      </Link>
    </Button>
  ) : spotsLeft <= 0 && game.joinPolicy === "open" && !cancelled && !past ? (
    <Button size="sm" variant="outline" onClick={onJoin}>
      Join Waitlist
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
        {...cardProps}
        className={cn(
          "surface-card flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors hover:border-primary/60 sm:gap-5 sm:rounded-2xl sm:p-4",
          (cancelled || past) && "opacity-60",
          className,
        )}
      >
        {/* Left: what & where (+ a compact when/spots line on phones) */}
        <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
          <div className="flex items-center gap-2">
            <SportTag sport={game.sport} />
            <span className="truncate text-[11px] font-semibold text-accent">
              {cancelled ? "Cancelled" : past ? "Game over" : relativeDayLabel(game.dateISO)}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-base leading-tight sm:text-lg">
            <Link to="/games/$gameId" params={{ gameId: game.id }} className="hover:text-primary">
              {game.venueName}
            </Link>
          </h3>
          <p className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{game.area}</span>
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground sm:hidden">
            {gameTimeLabel(game)} ·{" "}
            <span className="font-semibold text-foreground">
              {filled}/{game.spotsTotal}
            </span>{" "}
            joined{spotsLeft > 0 && spotsLeft <= 2 ? ` · ${spotsLeft} left` : ""}
          </p>
        </div>

        {/* Middle: details (tablet / desktop) */}
        <div className="hidden min-w-0 flex-1 space-y-1.5 text-sm sm:block">
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
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div className="gradient-primary h-full rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        {/* Right: price + action, always beside the info */}
        <div className="flex shrink-0 flex-col items-end gap-2 sm:w-40 sm:justify-center">
          <span className="text-sm font-bold text-foreground">{priceLabel}</span>
          {action}
        </div>
      </article>
    );
  }

  if (view === "compact") {
    return (
      <article
        {...cardProps}
        className={cn(
          "surface-card flex cursor-pointer flex-col gap-2 rounded-xl p-3 transition-colors hover:border-primary/60",
          (cancelled || past) && "opacity-60",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <SportTag sport={game.sport} />
          <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[10px] font-semibold text-accent">
            {cancelled ? "Cancelled" : past ? "Game over" : relativeDayLabel(game.dateISO)}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-base leading-tight">
            <Link to="/games/$gameId" params={{ gameId: game.id }} className="hover:text-primary">
              {game.venueName}
            </Link>
          </h3>
          <p className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{game.area}</span>
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{gameTimeLabel(game)}</span>
        </p>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              <Users className="h-3 w-3 text-primary" />
              {filled}/{game.spotsTotal}
            </span>
            <span className={spotsLeft <= 2 ? "font-bold text-accent" : "text-muted-foreground"}>
              {spotsLeft > 0 ? `${spotsLeft} left` : "Full"}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className="gradient-primary h-full rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="text-sm font-bold text-foreground">{priceLabel}</span>
          {action}
        </div>
      </article>
    );
  }

  return (
    <article
      {...cardProps}
      className={cn(
        "surface-card flex cursor-pointer flex-col gap-3 rounded-2xl p-4 transition-all hover:-translate-y-1 hover:border-primary/60",
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
