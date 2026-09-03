import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { CommunityEventDetail } from "@/data/community";
import { relativeDayLabel } from "@/lib/games";
import { Button } from "./Button";
import { SportTag } from "./SportTag";

export function EventCard({
  event,
  registered,
}: {
  event: CommunityEventDetail;
  registered?: boolean;
}) {
  const spotsLeft = Math.max(0, event.capacity - event.registered);
  return (
    <article className="surface-card group flex flex-col overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:border-primary/60">
      <Link
        to="/events/$eventId"
        params={{ eventId: event.id }}
        className="relative block aspect-[16/10] overflow-hidden"
      >
        <img
          src={event.image}
          alt={`${event.title} at ${event.venueName}, Kanpur`}
          loading="lazy"
          width={1024}
          height={640}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3">
          <SportTag sport={event.sport} />
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-on-image">
          {event.kind}
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="text-base leading-tight">
          <Link to="/events/$eventId" params={{ eventId: event.id }} className="hover:text-primary">
            {event.title}
          </Link>
        </h3>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          {relativeDayLabel(event.dateISO)} · {event.timeLabel}
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {event.venueName}, {event.area}
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {event.registered}/{event.capacity} registered
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-sm font-bold text-foreground">
            {event.entryFee === 0 ? (
              <span className="text-primary">Free</span>
            ) : (
              <>
                ₹{event.entryFee.toLocaleString("en-IN")}
                <span className="text-xs font-medium text-muted-foreground"> {event.feeUnit}</span>
              </>
            )}
          </span>
          <Button asChild size="sm" variant={registered ? "surface" : "primary"}>
            <Link to="/events/$eventId" params={{ eventId: event.id }}>
              {registered
                ? "Registered ✓"
                : spotsLeft === 0
                  ? "Waitlist"
                  : event.ctaType === "interest"
                    ? "Register Interest"
                    : "Register Now"}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
