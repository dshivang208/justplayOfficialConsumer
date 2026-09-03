import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus, Users } from "lucide-react";
import { PageShell, PageHeader, Chip } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { GroupCard } from "@/components/jp/GroupCard";
import { EmptyState } from "@/components/jp/states";
import { sports } from "@/data/landing";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";

type Search = { tab?: "mine" };

export const Route = createFileRoute("/groups")({
  validateSearch: (search: Record<string, unknown>): Search =>
    search["tab"] === "mine" ? { tab: "mine" } : {},
  head: () => ({
    meta: [
      { title: "Sports Groups & Communities in Kanpur | JustPlay" },
      {
        name: "description",
        content:
          "Join Kanpur sports communities — football circles, cricket crews and badminton squads that play every week.",
      },
      { property: "og:title", content: "Sports Groups in Kanpur | JustPlay" },
      { property: "og:description", content: "Find your crew and never look for players again." },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { tab: initialTab } = Route.useSearch();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { groups, joinedGroupIds, joinGroup, leaveGroup, myGroups } = useCommunity();

  const [tab, setTab] = useState<"all" | "mine">(initialTab ?? "all");
  const [sport, setSport] = useState("All");

  const filtered = useMemo(() => {
    const base = tab === "mine" ? myGroups : groups;
    return sport === "All" ? base : base.filter((g) => g.sport === sport);
  }, [tab, groups, myGroups, sport]);

  const handleToggle = (groupId: string, joined: boolean) => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: "/groups" } });
      return;
    }
    if (joined) leaveGroup(groupId);
    else joinGroup(groupId);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Your people"
        title="Groups"
        subtitle="Regular crews that play every week. Join one and never look for players again."
        action={
          <Button
            size="lg"
            onClick={() => {
              if (!isAuthenticated) {
                void navigate({ to: "/auth", search: { redirect: "/groups/create" } });
                return;
              }
              void navigate({ to: "/groups/create" });
            }}
          >
            <Plus className="h-4 w-4" /> Create a Group
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="inline-flex rounded-full border border-border bg-surface p-1">
          {(
            [
              { id: "all", label: "Discover" },
              { id: "mine", label: "My Groups" },
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

        <div className="mt-5 flex flex-wrap gap-2">
          <Chip active={sport === "All"} onClick={() => setSport("All")}>
            All sports
          </Chip>
          {sports.slice(0, 8).map((s) => (
            <Chip key={s.id} active={sport === s.name} onClick={() => setSport(s.name)}>
              {s.emoji} {s.name}
            </Chip>
          ))}
        </div>

        <div className="mt-6">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title={
                tab === "mine" ? "You haven't joined any groups" : "No groups match this filter"
              }
              description={
                tab === "mine"
                  ? "Discover a crew below or start your own."
                  : "Try a different sport, or start the first group there."
              }
              action={
                <Button asChild variant={tab === "mine" ? "primary" : "outline"}>
                  <Link to="/groups/create">Create a Group</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  joined={joinedGroupIds.includes(group.id)}
                  onToggle={() => handleToggle(group.id, joinedGroupIds.includes(group.id))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}