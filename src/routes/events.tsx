import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { PageShell, PageHeader, Chip } from "@/components/jp/PageShell";
import { EventCard } from "@/components/jp/EventCard";
import { EmptyState } from "@/components/jp/states";
import { sports } from "@/data/landing";
import type { CommunityEventDetail } from "@/data/community";
import { useCommunity } from "@/lib/community";

const kinds: Array<CommunityEventDetail["kind"]> = ["Tournament", "Coaching Camp", "Meetup"];

export const Route = createFileRoute("/events")({
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
  const { events, registeredEventIds } = useCommunity();
  const [sport, setSport] = useState("All");
  const [kind, setKind] = useState<CommunityEventDetail["kind"] | "All">("All");

  const eventSports = useMemo(
    () => sports.filter((s) => events.some((e) => e.sport === s.name)),
    [events],
  );

  const filtered = useMemo(
    () =>
      events.filter((e) => {
        if (sport !== "All" && e.sport !== sport) return false;
        if (kind !== "All" && e.kind !== kind) return false;
        return true;
      }),
    [events, sport, kind],
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
                <EventCard key={ev.id} event={ev} registered={registeredEventIds.includes(ev.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}