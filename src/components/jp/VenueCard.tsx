import { Link } from "@tanstack/react-router";
import { MapPin, Star, ArrowRight } from "lucide-react";
import type { Venue } from "@/data/landing";
import { cn } from "@/lib/utils";
import { SportTag } from "./SportTag";

function OpenBadge({ isOpenNow, className }: { isOpenNow: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        isOpenNow ? "bg-primary text-primary-foreground" : "bg-ink/70 text-on-image",
        className,
      )}
    >
      {isOpenNow ? "Open now" : "Closed"}
    </span>
  );
}

export function VenueCard({
  venue,
  view = "grid",
  className,
}: {
  venue: Venue;
  view?: "grid" | "list";
  className?: string;
}) {
  if (view === "list") {
    return (
      <Link
        to="/venues/$venueId"
        params={{ venueId: venue.id }}
        className={cn(
          "surface-card group flex gap-3 overflow-hidden rounded-2xl p-2.5 transition-all hover:-translate-y-0.5 hover:border-primary/60 sm:gap-4 sm:p-3",
          className,
        )}
      >
        <div className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-44">
          <img
            src={venue.image}
            alt={`${venue.name} in ${venue.area}, Kanpur`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <OpenBadge isOpenNow={venue.isOpenNow} className="absolute left-1.5 top-1.5" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base leading-tight sm:text-lg">{venue.name}</h3>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-accent">
              <Star className="h-3 w-3 fill-current" /> {venue.rating}
            </span>
          </div>
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {venue.area} · {venue.distanceKm} km
          </p>
          <div className="flex flex-wrap gap-1.5">
            {venue.sports.map((s) => (
              <SportTag key={s} sport={s} />
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">
              ₹{venue.pricePerHour}
              <span className="text-xs font-medium text-muted-foreground"> / hour</span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              Book Karo <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/venues/$venueId"
      params={{ venueId: venue.id }}
      className={cn(
        "surface-card group flex flex-col overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:border-primary/60",
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={venue.image}
          alt={`${venue.name} in ${venue.area}, Kanpur`}
          loading="lazy"
          width={1024}
          height={640}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <OpenBadge isOpenNow={venue.isOpenNow} className="absolute left-3 top-3" />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-bold text-accent backdrop-blur">
          <Star className="h-3 w-3 fill-current" /> {venue.rating}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div>
          <h3 className="text-base leading-tight">{venue.name}</h3>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {venue.area} · {venue.distanceKm} km away
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {venue.sports.map((s) => (
            <SportTag key={s} sport={s} />
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-bold text-foreground">
            ₹{venue.pricePerHour}
            <span className="text-xs font-medium text-muted-foreground"> / hour</span>
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
            Book Karo <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
