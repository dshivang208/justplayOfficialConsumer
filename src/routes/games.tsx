import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { PageShell, PageHeader, Chip } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { GameCard } from "@/components/jp/GameCard";
import { EmptyState } from "@/components/jp/states";
import { skillLevels, type SkillLevel } from "@/data/community";
import { sports } from "@/data/landing";
import { daysUntil } from "@/lib/games";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";

type Search = { tab?: "all" | "joined" | "mine" };

export const Route = createFileRoute("/games")({
  validateSearch: (search: Record<string, unknown>): Search =>
    search["tab"] === "joined" || search["tab"] === "mine" ? { tab: search["tab"] } : {},
  head: () => ({
    meta: [
      { title: "Hosted Games Near You in Kanpur | JustPlay" },
      {
        name: "description",
        content:
          "Join hosted games across Kanpur — box cricket, football, badminton and more. Filter by sport, date and skill level, then join in a tap.",
      },
      { property: "og:title", content: "Hosted Games in Kanpur | JustPlay" },
      {
        property: "og:description",
        content: "Ek spot lo aur pahunch jao — find a game near you.",
      },
    ],
  }),
  component: GamesPage,
});

const dateFilters = ["All", "Today", "Tomorrow", "This week"] as const;
type DateFilter = (typeof dateFilters)[number];

function GamesPage() {
  const { tab: initialTab } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { games, joinedGameIds, requestedGameIds, joinGame, requestJoin, myGames } = useCommunity();

  const [tab, setTab] = useState<"all" | "joined" | "mine">(initialTab ?? "all");
  const [sport, setSport] = useState("All");
  const [skillLevel, setSkillLevel] = useState<SkillLevel | "All">("All");
  const [dateFilter, setDateFilter] = useState<DateFilter>("All");

  const active = games.filter((g) => g.status === "active");

  const filtered = useMemo(() => {
    const base =
      tab === "mine"
        ? myGames
        : tab === "joined"
          ? active.filter((g) => joinedGameIds.includes(g.id))
          : active;
    return base.filter((g) => {
      if (sport !== "All" && g.sport !== sport) return false;
      if (skillLevel !== "All" && g.skillLevel !== skillLevel) return false;
      if (dateFilter !== "All") {
        const d = daysUntil(g.dateISO);
        if (dateFilter === "Today" && d !== 0) return false;
        if (dateFilter === "Tomorrow" && d !== 1) return false;
        if (dateFilter === "This week" && (d < 0 || d > 6)) return false;
      }
      return true;
    });
  }, [tab, active, myGames, joinedGameIds, sport, skillLevel, dateFilter]);

  const handleJoin = (gameId: string, approvalNeeded: boolean) => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: "/games" } });
      return;
    }
    if (approvalNeeded) requestJoin(gameId);
    else joinGame(gameId);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Community"
        title="Hosted Games Near You"
        subtitle="Games already booked by players in Kanpur. Filter, join and show up — no group chat chaos."
        action={
          <Button asChild size="lg">
            <Link to="/host">Host a Game</Link>
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          {(
            [
              { id: "all", label: "All Games" },
              { id: "joined", label: "Joined" },
              { id: "mine", label: "Hosted by Me" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors " +
                (tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Chip active={sport === "All"} onClick={() => setSport("All")}>
              All sports
            </Chip>
            {sports.slice(0, 8).map((s) => (
              <Chip key={s.id} active={sport === s.name} onClick={() => setSport(s.name)}>
                {s.emoji} {s.name}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {dateFilters.map((d) => (
              <Chip key={d} active={dateFilter === d} onClick={() => setDateFilter(d)}>
                {d}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={skillLevel === "All"} onClick={() => setSkillLevel("All")}>
              Any skill
            </Chip>
            {skillLevels.map((s) => (
              <Chip key={s} active={skillLevel === s} onClick={() => setSkillLevel(s)}>
                {s === "Any" ? "All levels" : s}
              </Chip>
            ))}
          </div>
        </div>

        <div className="mt-6">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title={
                tab === "mine"
                  ? "You haven't hosted a game yet"
                  : tab === "joined"
                    ? "You haven't joined any games"
                    : "No games match your filters"
              }
              description={
                tab === "mine"
                  ? "Host one and let players near you fill your squad."
                  : "Try a different sport, date or skill level."
              }
              action={
                tab === "mine" ? (
                  <Button asChild>
                    <Link to="/host">Host a Game</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  joined={joinedGameIds.includes(g.id)}
                  requested={requestedGameIds.includes(g.id)}
                  onJoin={() => handleJoin(g.id, g.joinPolicy === "approval")}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}