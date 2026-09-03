import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, MapPin, Search, Star } from "lucide-react";
import { PageShell, PageHeader, Chip } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { SlotGrid, SlotLegend } from "@/components/jp/booking/SlotGrid";
import { SportTag } from "@/components/jp/SportTag";
import { EmptyState } from "@/components/jp/states";
import { fetchVenues, fetchSlots, formatHour, type Slot, type VenueDetail } from "@/data/venues";
import { sports } from "@/data/landing";
import { upcomingDays, formatDateLong, formatINR, isContiguous } from "@/lib/booking";
import { skillLevels, type SkillLevel } from "@/data/community";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/host")({
  head: () => ({
    meta: [
      { title: "Host a Game in Kanpur | JustPlay" },
      {
        name: "description",
        content:
          "Pick a venue and slot, set your spots and skill level, and let nearby players fill your squad. Host cricket, football and badminton games across Kanpur.",
      },
      { property: "og:title", content: "Host a Game in Kanpur | JustPlay" },
      {
        property: "og:description",
        content: "Host a game, split the cost per head and let nearby players join.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HostGamePage,
});

const stepLabels = ["Sport & venue", "Date & time", "Game details", "Confirm"];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-8 flex flex-wrap items-center gap-2 text-xs font-semibold">
      {stepLabels.map((label, i) => {
        const state = i < step ? "done" : i === step ? "current" : "todo";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border text-[11px]",
                state === "done" && "border-primary bg-primary text-primary-foreground",
                state === "current" && "border-primary text-primary",
                state === "todo" && "border-border text-muted-foreground",
              )}
            >
              {state === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={state === "todo" ? "text-muted-foreground" : "text-foreground"}>
              {label}
            </span>
            {i < stepLabels.length - 1 ? (
              <span className="mx-1 hidden h-px w-6 bg-border sm:block" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function HostGamePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { hostGame } = useCommunity();

  const [step, setStep] = useState(0);
  const [sport, setSport] = useState<string>("Box Cricket");
  const [query, setQuery] = useState("");
  const [venueId, setVenueId] = useState<string | null>(null);
  const days = useMemo(() => upcomingDays(14), []);
  const [dateISO, setDateISO] = useState(days[0]!.iso);
  const [selected, setSelected] = useState<Slot[]>([]);

  const [spotsTotal, setSpotsTotal] = useState(10);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("Any");
  const [costMode, setCostMode] = useState<"free" | "split">("split");
  const [joinPolicy, setJoinPolicy] = useState<"open" | "approval">("open");
  const [description, setDescription] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [allVenues, setAllVenues] = useState<VenueDetail[]>([]);
  useEffect(() => {
    let active = true;
    fetchVenues().then((v) => {
      if (active) setAllVenues(v);
    });
    return () => {
      active = false;
    };
  }, []);

  const venue = allVenues.find((v) => v.id === venueId) ?? null;

  const matchingVenues = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allVenues.filter(
      (v) =>
        v.sports.includes(sport) &&
        (q === "" || v.name.toLowerCase().includes(q) || v.area.toLowerCase().includes(q)),
    );
  }, [allVenues, sport, query]);

  const [slots, setSlots] = useState<Slot[]>([]);
  useEffect(() => {
    if (!venue) {
      setSlots([]);
      return;
    }
    let active = true;
    fetchSlots(venue.id, dateISO, sport).then((s) => {
      if (active) setSlots(s);
    });
    return () => {
      active = false;
    };
  }, [venue, dateISO, sport]);

  const totalCost = selected.reduce((s, x) => s + x.price, 0);
  const costPerHead = costMode === "split" ? Math.round(totalCost / Math.max(spotsTotal, 1)) : 0;

  const toggleSlot = (slot: Slot) => {
    setSelected((prev) => {
      const exists = prev.some((s) => s.id === slot.id);
      const next = exists ? prev.filter((s) => s.id !== slot.id) : [...prev, slot];
      return next.length <= 1 || isContiguous(next) ? next : [slot];
    });
  };

  const canNext =
    (step === 0 && venue !== null) ||
    (step === 1 && selected.length > 0) ||
    (step === 2 && spotsTotal >= 2) ||
    step === 3;

  const publish = async () => {
    if (!venue) return;
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: "/host" } });
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const sorted = [...selected].sort((a, b) => a.startHour - b.startHour);
      const game = await hostGame({
        sport,
        venueId: venue.id,
        venueName: venue.name,
        area: venue.area,
        dateISO,
        startHour: sorted[0]!.startHour,
        endHour: sorted[sorted.length - 1]!.startHour + 1,
        spotsTotal,
        skillLevel,
        costMode,
        totalCost,
        description: description.trim(),
        joinPolicy,
      });
      void navigate({ to: "/games/$gameId", params: { gameId: game.id }, search: { new: true } });
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Could not publish this game. Try again.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Host a Game"
        title="Fill your squad"
        subtitle="Book a slot, open it up to players near you and split the cost per head."
      />

      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Stepper step={step} />

        {step === 0 ? (
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl">Which sport?</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {sports.slice(0, 8).map((s) => (
                  <Chip
                    key={s.id}
                    active={sport === s.name}
                    onClick={() => {
                      setSport(s.name);
                      setVenueId(null);
                      setSelected([]);
                    }}
                  >
                    {s.emoji} {s.name}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl">Pick a venue</h2>
              <label className="mt-3 flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search venue or area in Kanpur"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </label>

              {matchingVenues.length === 0 ? (
                <EmptyState
                  title="No venues for this sport"
                  description="Try another sport or clear the search."
                />
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {matchingVenues.map((v) => {
                    const active = v.id === venueId;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVenueId(v.id);
                          setSelected([]);
                        }}
                        className={cn(
                          "surface-card flex items-center gap-3 overflow-hidden rounded-2xl p-2.5 text-left transition-all hover:-translate-y-0.5",
                          active && "border-primary ring-1 ring-primary",
                        )}
                      >
                        <img
                          src={v.image}
                          alt={v.name}
                          loading="lazy"
                          className="h-16 w-20 shrink-0 rounded-xl object-cover"
                        />
                        <div className="min-w-0">
                          <h3 className="truncate text-base leading-tight">{v.name}</h3>
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {v.area} · {v.distanceKm} km
                          </p>
                          <p className="mt-1 flex items-center gap-2 text-xs font-semibold">
                            <span className="inline-flex items-center gap-1 text-accent">
                              <Star className="h-3 w-3 fill-current" /> {v.rating}
                            </span>
                            <span className="text-foreground">
                              {formatINR(v.pricePerHour)}
                              <span className="font-medium text-muted-foreground">/hr</span>
                            </span>
                          </p>
                        </div>
                        {active ? <Check className="ml-auto h-5 w-5 text-primary" /> : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {step === 1 && venue ? (
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl">Pick a date</h2>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {days.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => {
                      setDateISO(d.iso);
                      setSelected([]);
                    }}
                    className={cn(
                      "flex min-w-16 flex-col items-center rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                      d.iso === dateISO
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-muted-foreground hover:border-primary",
                    )}
                  >
                    <span>{d.isToday ? "Today" : d.weekday}</span>
                    <span className="text-base">{d.day}</span>
                    <span>{d.month}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl">Pick your slot</h2>
                <SlotLegend />
              </div>
              <SlotGrid
                slots={slots}
                selectedIds={selected.map((s) => s.id)}
                onToggle={toggleSlot}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Select one or more back-to-back hours at {venue.name}.
              </p>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl">How many players?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Total spots including you. Everyone sees "{Math.min(1, spotsTotal)}/{spotsTotal}{" "}
                  joined" until players sign up.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSpotsTotal((n) => Math.max(2, n - 1))}
                  >
                    –
                  </Button>
                  <span className="w-14 text-center font-display text-3xl">{spotsTotal}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSpotsTotal((n) => Math.min(30, n + 1))}
                  >
                    +
                  </Button>
                  <span className="text-sm text-muted-foreground">spots</span>
                </div>
              </div>

              <div>
                <h2 className="text-2xl">Skill level</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {skillLevels.map((s) => (
                    <Chip key={s} active={skillLevel === s} onClick={() => setSkillLevel(s)}>
                      {s === "Any" ? "All levels" : s}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-2xl">Cost</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      { id: "split", title: "Split cost", copy: "Players pay an equal share." },
                      { id: "free", title: "Free to join", copy: "You're covering the slot." },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setCostMode(o.id)}
                      className={cn(
                        "surface-card rounded-2xl p-4 text-left transition-all",
                        costMode === o.id && "border-primary ring-1 ring-primary",
                      )}
                    >
                      <p className="font-semibold">{o.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{o.copy}</p>
                      {o.id === "split" ? (
                        <p className="mt-2 text-sm font-bold text-primary">
                          {formatINR(Math.round(totalCost / Math.max(spotsTotal, 1)))} / head
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="text-2xl">Who can join?</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip active={joinPolicy === "open"} onClick={() => setJoinPolicy("open")}>
                    Open — anyone can join
                  </Chip>
                  <Chip
                    active={joinPolicy === "approval"}
                    onClick={() => setJoinPolicy("approval")}
                  >
                    Approval needed
                  </Chip>
                </div>
              </div>

              <div>
                <h2 className="text-2xl">Description (optional)</h2>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Format, ball type, what to bring…"
                  className="mt-3 w-full rounded-2xl border border-border bg-surface p-4 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>

            <aside className="surface-card h-fit rounded-2xl p-5">
              <h3 className="text-xl">Summary</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Sport" value={sport} />
                <Row label="Venue" value={venue?.name ?? "—"} />
                <Row label="Date" value={formatDateLong(dateISO)} />
                <Row
                  label="Time"
                  value={
                    selected.length
                      ? `${formatHour(Math.min(...selected.map((s) => s.startHour)))} – ${formatHour(
                          Math.max(...selected.map((s) => s.startHour)) + 1,
                        )}`
                      : "—"
                  }
                />
                <Row label="Slot cost" value={formatINR(totalCost)} />
                <Row
                  label="Per head"
                  value={costMode === "free" ? "Free" : formatINR(costPerHead)}
                />
              </dl>
            </aside>
          </section>
        ) : null}

        {step === 3 && venue ? (
          <section className="mx-auto max-w-xl">
            <div className="surface-card rounded-2xl p-6">
              <SportTag sport={sport} />
              <h2 className="mt-3 text-3xl leading-tight">{venue.name}</h2>
              <p className="text-sm text-muted-foreground">
                {venue.area}, Kanpur · {formatDateLong(dateISO)}
              </p>
              <dl className="mt-5 space-y-2 text-sm">
                <Row
                  label="Time"
                  value={`${formatHour(Math.min(...selected.map((s) => s.startHour)))} – ${formatHour(
                    Math.max(...selected.map((s) => s.startHour)) + 1,
                  )}`}
                />
                <Row label="Spots" value={`${spotsTotal} players`} />
                <Row label="Skill" value={skillLevel === "Any" ? "All levels" : skillLevel} />
                <Row
                  label="Cost"
                  value={
                    costMode === "free" ? "Free to join" : `${formatINR(costPerHead)} per head`
                  }
                />
                <Row
                  label="Joining"
                  value={joinPolicy === "open" ? "Open to all" : "Approval needed"}
                />
              </dl>
              {description ? (
                <p className="mt-4 rounded-xl bg-secondary p-3 text-sm text-muted-foreground">
                  {description}
                </p>
              ) : null}
              <Button className="mt-6 w-full" size="lg" onClick={publish} disabled={publishing}>
                {publishing ? "Publishing…" : "Publish game"}
              </Button>
              {publishError ? (
                <p className="mt-3 text-center text-xs font-semibold text-destructive">{publishError}</p>
              ) : null}
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Your game appears in the Hosted Games feed instantly.
              </p>
            </div>
          </section>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < 3 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}