import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Clock, History, MapPin, Trophy, Users } from "lucide-react";
import { PageShell, PageHeader } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { SportTag } from "@/components/jp/SportTag";
import { EmptyState } from "@/components/jp/states";
import { useAuth } from "@/lib/auth";
import { useCommunity } from "@/lib/community";
import { gameTimeLabel } from "@/lib/games";
import { formatDateLong } from "@/lib/booking";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/game-history")({
  head: () => ({
    meta: [
      { title: "My Game History | JustPlay" },
      {
        name: "description",
        content: "Every game you've hosted or played on JustPlay, in one place.",
      },
    ],
  }),
  component: GameHistoryPage,
});

type Tab = "all" | "hosted" | "played";

function GameHistoryPage() {
  const navigate = useNavigate();
  const { isAuthenticated, hydrated } = useAuth();
  const { games, joinedGameIds, loading } = useCommunity();
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: "/game-history" } });
    }
  }, [hydrated, isAuthenticated, navigate]);

  // History = anything that's finished or was cancelled, where I hosted it
  // or was a confirmed player. Newest first.
  const history = useMemo(() => {
    return games
      .filter((g) => g.status !== "active")
      .filter((g) => g.isMine || joinedGameIds.includes(g.id))
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO) || b.startHour - a.startHour);
  }, [games, joinedGameIds]);

  const hostedCount = history.filter((g) => g.isMine).length;
  const playedCount = history.filter((g) => !g.isMine && g.status === "completed").length;
  const list = history.filter((g) =>
    tab === "hosted" ? g.isMine : tab === "played" ? !g.isMine : true,
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "All", count: history.length },
    { key: "hosted", label: "Hosted", count: hostedCount },
    { key: "played", label: "Played", count: history.filter((g) => !g.isMine).length },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Your games"
        title="Game History"
        subtitle="Games you hosted or joined that are done — finished games leave the home page and land here."
      />
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="surface-card rounded-2xl p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Trophy className="h-4.5 w-4.5" />
            </span>
            <p className="mt-3 font-display text-3xl leading-none">{hostedCount}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Games hosted</p>
          </div>
          <div className="surface-card rounded-2xl p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Users className="h-4.5 w-4.5" />
            </span>
            <p className="mt-3 font-display text-3xl leading-none">{playedCount}</p>
            <p className="mt-1 text-xs font-semibold text-muted-foreground">Games played</p>
          </div>
        </div>

        <div className="mt-6 flex gap-1 rounded-xl bg-surface-raised p-1 sm:inline-flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors sm:flex-none",
                tab === t.key
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label} <span className="text-xs opacity-70">{t.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-4">
          {loading && history.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="surface-card h-24 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={<History className="h-8 w-8" />}
              title={
                tab === "hosted"
                  ? "No finished games hosted yet"
                  : tab === "played"
                    ? "No games played yet"
                    : "No game history yet"
              }
              description="Once a game you host or join is over, it will show up here."
              action={
                <Button asChild>
                  <Link to="/games">Find a game</Link>
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((g) => {
                const cancelled = g.status === "cancelled";
                return (
                  <li key={g.id}>
                    <Link
                      to="/games/$gameId"
                      params={{ gameId: g.id }}
                      className="surface-card block rounded-2xl p-4 transition-colors hover:border-primary/40"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <SportTag sport={g.sport} />
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                            g.isMine
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-accent/40 bg-accent/10 text-accent",
                          )}
                        >
                          {g.isMine ? "You hosted" : "You played"}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                            cancelled
                              ? "border-destructive/40 bg-destructive/10 text-destructive"
                              : "border-border bg-surface text-muted-foreground",
                          )}
                        >
                          {cancelled ? "Cancelled" : "Completed"}
                        </span>
                      </div>
                      <h3 className="mt-2.5 text-lg leading-tight">{g.venueName}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" /> {formatDateLong(g.dateISO)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {gameTimeLabel(g)}
                        </span>
                        {g.area ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {g.area}
                          </span>
                        ) : null}
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" /> {g.players.length}/{g.spotsTotal} players
                        </span>
                      </div>
                      {!g.isMine ? (
                        <p className="mt-2 text-xs text-muted-foreground">Hosted by {g.hostName}</p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
}
