import { Clock, MapPin, Users } from "lucide-react";
import type { HostedGame } from "@/data/landing";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export function HostedGameCard({ game, className }: { game: HostedGame; className?: string }) {
  const spotsLeft = game.spotsTotal - game.spotsFilled;
  const pct = Math.round((game.spotsFilled / game.spotsTotal) * 100);

  return (
    <article className={cn("surface-card flex flex-col gap-3 rounded-2xl p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
            {game.sport}
          </span>
          <h3 className="mt-2 text-lg leading-tight">{game.venueName}</h3>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {game.area}
          </p>
        </div>
        <span className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-accent">
          {game.day}
        </span>
      </div>

      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 text-primary" /> {game.startsAt}
      </p>

      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
          {game.hostInitials}
        </span>
        <div className="text-xs">
          <p className="font-semibold text-foreground">Hosted by {game.hostName}</p>
          <p className="text-muted-foreground">{game.skillLevel}</p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
            <Users className="h-3.5 w-3.5 text-primary" />
            {game.spotsFilled}/{game.spotsTotal} joined
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
          ₹{game.pricePerHead}
          <span className="text-xs font-medium text-muted-foreground"> / head</span>
        </span>
        <Button size="sm" disabled={spotsLeft === 0}>
          {spotsLeft === 0 ? "Full" : "Join Game"}
        </Button>
      </div>
    </article>
  );
}
