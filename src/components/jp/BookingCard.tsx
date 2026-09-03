import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, Clock, MapPin, RotateCcw, ShieldCheck, X } from "lucide-react";
import { Button } from "./Button";
import { SportTag } from "./SportTag";
import { cn } from "@/lib/utils";
import { formatINR, formatDateLong } from "@/lib/booking";
import {
  CANCELLATION_WINDOW_HOURS,
  refundEligible,
  timeRangeLabel,
  type Booking,
} from "@/data/bookings";

function StatusBadge({ status }: { status: Booking["status"] }) {
  const map: Record<Booking["status"], string> = {
    confirmed: "bg-primary text-primary-foreground",
    pending: "bg-accent text-accent-foreground",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
    cancelled_refunded: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        map[status],
      )}
    >
      {status}
    </span>
  );
}

export function BookingCard({
  booking,
  variant,
  onCancel,
  onReschedule,
}: {
  booking: Booking;
  variant: "upcoming" | "past";
  onCancel?: (b: Booking) => Promise<void> | void;
  onReschedule?: (b: Booking) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const refundable = refundEligible(booking);

  return (
    <article className="surface-card overflow-hidden rounded-2xl">
      <div className="flex gap-3 p-2.5 sm:gap-4 sm:p-3">
        <Link
          to="/venues/$venueId"
          params={{ venueId: booking.venueId }}
          className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-40"
        >
          <img
            src={booking.venueImage}
            alt={`${booking.venueName}, ${booking.area}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base leading-tight sm:text-lg">{booking.venueName}</h3>
            <StatusBadge status={booking.status} />
          </div>
          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {booking.area}, Kanpur
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {formatDateLong(booking.date)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {timeRangeLabel(booking)}
            </span>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2">
            <SportTag sport={booking.sport} />
            <span className="text-sm font-bold">
              {booking.amountPaid > 0 ? formatINR(booking.amountPaid) : "Refunded"}
              <span className="text-[11px] font-medium text-muted-foreground"> · #{booking.id}</span>
            </span>
          </div>
        </div>
      </div>

      {variant === "upcoming" ? (
        <div className="border-t border-border p-3">
          {confirming ? (
            <div className="flex flex-col gap-3">
              <div
                className={cn(
                  "flex gap-2 rounded-xl p-3 text-xs",
                  refundable ? "bg-primary/10 text-foreground" : "bg-destructive/10 text-foreground",
                )}
              >
                {refundable ? (
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <p>
                  {refundable ? (
                    <>
                      <span className="font-bold">Free cancellation.</span> You're cancelling more
                      than {CANCELLATION_WINDOW_HOURS} hours before your slot, so you'll get a full
                      refund of {formatINR(booking.amountPaid)} to your original payment method in
                      3–5 working days.
                    </>
                  ) : (
                    <>
                      <span className="font-bold">Cancellation window passed.</span> Your slot
                      starts in under {CANCELLATION_WINDOW_HOURS} hours — cancelling now means{" "}
                      <span className="font-bold">no refund</span>.
                    </>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirming(false)}>
                  Keep booking
                </Button>
                <Button
                  size="sm"
                  variant="accent"
                  className="flex-1"
                  disabled={cancelling}
                  onClick={async () => {
                    setCancelling(true);
                    setCancelError(null);
                    try {
                      await onCancel?.(booking);
                      setConfirming(false);
                    } catch (e) {
                      setCancelError(e instanceof Error ? e.message : "Could not cancel this booking. Try again.");
                    } finally {
                      setCancelling(false);
                    }
                  }}
                >
                  {cancelling ? "Cancelling…" : "Confirm cancel"}
                </Button>
              </div>
              {cancelError ? <p className="text-xs font-semibold text-destructive">{cancelError}</p> : null}
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirming(true)}>
                <X className="h-3.5 w-3.5" /> Cancel Booking
              </Button>
              {onReschedule ? (
                <Button variant="surface" size="sm" className="flex-1" onClick={() => onReschedule(booking)}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reschedule
                </Button>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-border p-3">
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/book/$venueId" params={{ venueId: booking.venueId }}>
              Book Again
            </Link>
          </Button>
        </div>
      )}
    </article>
  );
}