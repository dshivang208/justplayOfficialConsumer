import { Link } from "@tanstack/react-router";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { CommunityEventDetail } from "@/data/community";
import { daysUntil, relativeDayLabel } from "@/lib/games";
import { Button } from "./Button";
import { SportTag } from "./SportTag";

export function EventCard({
  event,
  registered,
  onRegister,
  registering,
  view = "grid",
}: {
  view?: "grid" | "list";
  event: CommunityEventDetail;
  registered?: boolean;
  /** When provided, "Register Now"/"Register Interest" performs the real
   *  registration immediately, right here — it does not just navigate to
   *  the detail page and leave the actual registering for a second click. */
  onRegister?: () => void;
  registering?: boolean;
}) {
  const spotsLeft = Math.max(0, event.capacity - event.registered);
  const full = spotsLeft === 0 && !registered;
  const past = daysUntil(event.dateISO) < 0;
  const priceLabel = (
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
  );
  const action = (
    <>
          {registered ? (
            <Button asChild size="sm" variant="surface">
              <Link to="/events/$eventId" params={{ eventId: event.id }}>
                Registered ✓
              </Link>
            </Button>
          ) : past ? (
            <Button size="sm" variant="surface" disabled>
              Event over
            </Button>
          ) : full ? (
            <Button size="sm" variant="surface" disabled>
              Fully Booked
            </Button>
          ) : onRegister ? (
            <Button size="sm" disabled={registering} onClick={onRegister}>
              {registering
                ? "Registering…"
                : event.ctaType === "interest"
                  ? "Register Interest"
                  : "Register Now"}
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/events/$eventId" params={{ eventId: event.id }}>
                {event.ctaType === "interest" ? "Register Interest" : "Register Now"}
              </Link>
            </Button>
          )}
    </>
  );

  if (view === "list") {
    return (
      <article
        className={`surface-card group flex gap-3 overflow-hidden rounded-2xl p-3 transition-colors hover:border-primary/60 ${
          past && !registered ? "opacity-60" : ""
        }`}
      >
        <Link
          to="/events/$eventId"
          params={{ eventId: event.id }}
          className="relative block h-24 w-24 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-40"
        >
          <img
            src={event.image}
            alt={`${event.title} at ${event.venueName}, Kanpur`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute left-1.5 top-1.5 hidden sm:block">
            <SportTag sport={event.sport} />
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {event.kind}
            </span>
            <span className="text-[11px] font-semibold text-muted-foreground sm:hidden">
              {event.sport}
            </span>
          </div>
          <h3 className="line-clamp-2 text-base leading-tight">
            <Link to="/events/$eventId" params={{ eventId: event.id }} className="hover:text-primary">
              {event.title}
            </Link>
          </h3>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">
              {past ? "Event over" : relativeDayLabel(event.dateISO)} · {event.timeLabel}
            </span>
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {event.venueName}, {event.area}
            </span>
          </p>
          <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
            <Users className="h-3.5 w-3.5" /> {event.registered}/{event.capacity} registered
          </p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 sm:hidden">
            {priceLabel}
            {action}
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end justify-between gap-2 sm:flex sm:w-40">
          {priceLabel}
          {action}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`surface-card group flex flex-col overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:border-primary/60 ${
        past && !registered ? "opacity-60" : ""
      }`}
    >
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
          {past ? "Event over" : relativeDayLabel(event.dateISO)} · {event.timeLabel}
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {event.venueName}, {event.area}
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {event.registered}/{event.capacity} registered
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
          {priceLabel}
          {action}
        </div>
      </div>
    </article>
  );
}