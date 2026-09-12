import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { PageShell, PageHeader, Chip } from "@/components/jp/PageShell";
import { EventCard } from "@/components/jp/EventCard";
import { EmptyState } from "@/components/jp/states";
import { sports } from "@/data/landing";
import type { CommunityEventDetail } from "@/data/community";
import { daysUntil } from "@/lib/games";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";

const kinds: Array<CommunityEventDetail["kind"]> = ["Tournament", "Coaching Camp", "Meetup"];
type DateFilter = "all" | "week" | "month";
type FeeFilter = "all" | "free" | "paid";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Tournaments & Sports Events in Kanpur | JustPlay" },
      {
        name: "description",
        content:
          "Local leagues, weekend cups and coaching camps across Kanpur. Register your team on JustPlay.",
      },
      { property: "og:title", content: "Tournaments & Events in Kanpur | JustPlay" },
      {
        property: "og:description",
        content: "Compete in local tournaments and join coaching camps near you.",
      },
    ],
  }),
  component: EventsPage,
});

function EventsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { events, registeredEventIds, registerEvent } = useCommunity();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleRegister = async (eventId: string) => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: "/events" } });
      return;
    }
    setBusyId(eventId);
    try {
      await registerEvent(eventId);
      toast.success("You're registered!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't register for this event.");
    } finally {
      setBusyId(null);
    }
  };
  const [sport, setSport] = useState("All");
  const [kind, setKind] = useState<CommunityEventDetail["kind"] | "All">("All");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [feeFilter, setFeeFilter] = useState<FeeFilter>("all");

  const eventSports = useMemo(
    () => sports.filter((s) => events.some((e) => e.sport === s.name)),
    [events],
  );

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (sport !== "All" && e.sport !== sport) return false;
        if (kind !== "All" && e.kind !== kind) return false;
        if (dateFilter === "week" && daysUntil(e.dateISO) > 7) return false;
        if (dateFilter === "month" && daysUntil(e.dateISO) > 30) return false;
        if (feeFilter === "free" && e.entryFee > 0) return false;
        if (feeFilter === "paid" && e.entryFee === 0) return false;
        return true;
      }),
    [events, sport, kind, dateFilter, feeFilter],
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Compete"
        title="Events & Tournaments"
        subtitle="Local leagues, weekend cups and coaching camps happening across Kanpur."
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Chip active={kind === "All"} onClick={() => setKind("All")}>
              All types
            </Chip>
            {kinds.map((k) => (
              <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                {k}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={sport === "All"} onClick={() => setSport("All")}>
              All sports
            </Chip>
            {eventSports.map((s) => (
              <Chip key={s.id} active={sport === s.name} onClick={() => setSport(s.name)}>
                {s.emoji} {s.name}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={dateFilter === "all"} onClick={() => setDateFilter("all")}>
              Any date
            </Chip>
            <Chip active={dateFilter === "week"} onClick={() => setDateFilter("week")}>
              This week
            </Chip>
            <Chip active={dateFilter === "month"} onClick={() => setDateFilter("month")}>
              This month
            </Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={feeFilter === "all"} onClick={() => setFeeFilter("all")}>
              Any entry fee
            </Chip>
            <Chip active={feeFilter === "free"} onClick={() => setFeeFilter("free")}>
              Free
            </Chip>
            <Chip active={feeFilter === "paid"} onClick={() => setFeeFilter("paid")}>
              Paid
            </Chip>
          </div>
        </div>

        <div className="mt-6">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Trophy className="h-8 w-8" />}
              title="No events match your filters"
              description="New tournaments drop every month. Try a different sport or type."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((ev) => (
                <EventCard
                  key={ev.id}
                  event={ev}
                  registered={registeredEventIds.includes(ev.id)}
                  registering={busyId === ev.id}
                  onRegister={() => handleRegister(ev.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}