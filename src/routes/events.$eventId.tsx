import { useState, type ReactNode } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Trophy, Users } from "lucide-react";
import { PageShell } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { SportTag } from "@/components/jp/SportTag";
import { formatDateLong } from "@/lib/booking";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/events/$eventId")({
  head: () => ({
    meta: [
      { title: "Event details | JustPlay" },
      { name: "description", content: "Register for this Kanpur sports event or tournament." },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-4xl">Event not found</h1>
        <Button asChild className="mt-6">
          <Link to="/events">Browse events</Link>
        </Button>
      </div>
    </div>
  ),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { getEvent, registeredEventIds, registerEvent, unregisterEvent, loading } = useCommunity();

  const [stage, setStage] = useState<"detail" | "confirm" | "done">("detail");
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const event = getEvent(eventId);
  if (!event) {
    if (loading) {
      return (
        <PageShell>
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
            Loading event…
          </div>
        </PageShell>
      );
    }
    throw notFound();
  }

  const registered = registeredEventIds.includes(event.id);
  const spotsLeft = Math.max(0, event.capacity - event.registered);
  const ctaLabel = event.ctaType === "interest" ? "Register Interest" : "Register Now";

  const startRegistration = () => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: `/events/${event.id}` } });
      return;
    }
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setStage("confirm");
  };

  const confirm = async () => {
    setConfirming(true);
    setConfirmError(null);
    try {
      await registerEvent(event.id);
      setStage("done");
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Could not register. This event may be full.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <PageShell>
      {stage !== "done" ? (
        <div className="relative h-56 w-full overflow-hidden sm:h-72">
          <img
            src={event.image}
            alt={`${event.title} at ${event.venueName}, Kanpur`}
            className="h-full w-full object-cover"
          />
          <div className="gradient-hero-overlay absolute inset-0" />
          <Link
            to="/events"
            className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-ink/60 px-3 py-1.5 text-xs font-semibold text-on-image backdrop-blur sm:left-6 sm:top-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Events
          </Link>
          <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
            <div className="flex items-center gap-2">
              <SportTag sport={event.sport} />
              <span className="rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-on-image">
                {event.kind}
              </span>
            </div>
            <h1 className="mt-2 text-4xl leading-none text-on-image sm:text-5xl">{event.title}</h1>
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        {stage === "detail" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow
                icon={<CalendarDays className="h-4 w-4" />}
                label="When"
                value={`${formatDateLong(event.dateISO)} · ${event.timeLabel}`}
              />
              <InfoRow
                icon={<MapPin className="h-4 w-4" />}
                label="Where"
                value={`${event.venueName}, ${event.area}`}
              />
              <InfoRow
                icon={<Users className="h-4 w-4" />}
                label="Participants"
                value={`${event.registered}/${event.capacity} registered`}
              />
              <InfoRow
                icon={<Trophy className="h-4 w-4" />}
                label="Entry fee"
                value={
                  event.entryFee === 0
                    ? "Free entry"
                    : `₹${event.entryFee.toLocaleString("en-IN")} ${event.feeUnit}`
                }
              />
            </div>

            <div className="surface-card mt-6 rounded-2xl p-5">
              <h2 className="text-2xl leading-none">About this event</h2>
              <p className="mt-2 text-sm text-muted-foreground">{event.description}</p>
            </div>

            <div className="surface-card mt-5 flex items-center gap-3 rounded-2xl p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold">
                {event.organizerInitials}
              </span>
              <div>
                <p className="text-sm font-semibold">{event.organizerName}</p>
                <p className="text-xs text-muted-foreground">{event.organizerAbout}</p>
              </div>
            </div>

            <div className="mt-6">
              {registered ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="flex-1" variant="surface" disabled>
                    <CheckCircle2 className="h-4 w-4" /> Registered
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 text-destructive hover:bg-destructive/10"
                    onClick={() => unregisterEvent(event.id)}
                  >
                    Cancel registration
                  </Button>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={spotsLeft === 0}
                  onClick={startRegistration}
                >
                  {spotsLeft === 0 ? "Full — join waitlist soon" : ctaLabel}
                </Button>
              )}
            </div>
          </>
        ) : null}

        {stage === "confirm" ? (
          <div className="surface-card rounded-2xl p-5 sm:p-6">
            <h2 className="text-2xl leading-none">Confirm your details</h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {event.title} · {formatDateLong(event.dateISO)}
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="rname"
                  className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  Name
                </label>
                <input
                  id="rname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="rphone"
                  className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
                >
                  Phone
                </label>
                <input
                  id="rphone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary"
                />
              </div>
              <div className="rounded-xl bg-secondary p-3.5 text-sm text-muted-foreground">
                {event.entryFee === 0
                  ? "This event is free — no payment needed."
                  : `Entry fee: ₹${event.entryFee.toLocaleString("en-IN")} ${event.feeUnit}. Payment collected at the venue.`}
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStage("detail")}>
                Back
              </Button>
              <Button className="flex-1" disabled={!name.trim() || !phone.trim() || confirming} onClick={confirm}>
                {confirming ? "Confirming…" : "Confirm"}
              </Button>
            </div>
            {confirmError ? (
              <p className="mt-3 text-center text-xs font-semibold text-destructive">{confirmError}</p>
            ) : null}
          </div>
        ) : null}

        {stage === "done" ? (
          <div className="mx-auto max-w-md py-10 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-9 w-9" />
            </span>
            <h1 className="mt-4 text-4xl leading-none">
              {event.ctaType === "interest" ? "Interest registered!" : "You're in!"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {name}, we've noted your registration for {event.title}.
            </p>

            <div className="surface-card mt-6 rounded-2xl p-4 text-left">
              <dl className="flex flex-col gap-2 text-sm">
                {(
                  [
                    ["Event", event.title],
                    ["Date", formatDateLong(event.dateISO)],
                    ["Time", event.timeLabel],
                    ["Venue", `${event.venueName}, ${event.area}`],
                    ["Name", name],
                    ["Phone", phone],
                  ] as Array<[string, string]>
                ).map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-4">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <Button asChild className="mt-6 w-full">
              <Link to="/events">Browse more events</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}

function InfoRow({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-3.5 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-right text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}