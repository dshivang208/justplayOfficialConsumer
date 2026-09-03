import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Lock, MapPin, Users } from "lucide-react";
import { PageShell } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { SportTag } from "@/components/jp/SportTag";
import { GameCard } from "@/components/jp/GameCard";
import { EmptyState } from "@/components/jp/states";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/groups/$groupId")({
  head: () => ({
    meta: [
      { title: "Group details | JustPlay" },
      {
        name: "description",
        content: "See members, upcoming games and join this Kanpur sports group.",
      },
    ],
  }),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-4xl">Group not found</h1>
        <Button asChild className="mt-6">
          <Link to="/groups">Browse groups</Link>
        </Button>
      </div>
    </div>
  ),
  component: GroupDetailPage,
});

function GroupDetailPage() {
  const { groupId } = Route.useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const {
    getGroup,
    joinedGroupIds,
    joinGroup,
    leaveGroup,
    gamesForGroup,
    joinedGameIds,
    requestedGameIds,
    joinGame,
    requestJoin,
    loading,
  } = useCommunity();

  const group = getGroup(groupId);
  if (!group) {
    if (loading) {
      return (
        <PageShell>
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
            Loading group…
          </div>
        </PageShell>
      );
    }
    throw notFound();
  }

  const joined = joinedGroupIds.includes(group.id);
  const games = gamesForGroup(group.id);

  const toggleMembership = () => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: `/groups/${group.id}` } });
      return;
    }
    if (joined) leaveGroup(group.id);
    else joinGroup(group.id);
  };

  const handleJoinGame = (gameId: string, approvalNeeded: boolean) => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: `/groups/${group.id}` } });
      return;
    }
    if (approvalNeeded) requestJoin(gameId);
    else joinGame(gameId);
  };

  return (
    <PageShell>
      <div className="relative h-56 w-full overflow-hidden sm:h-72">
        <img
          src={group.image}
          alt={`${group.name} community in Kanpur`}
          className="h-full w-full object-cover"
        />
        <div className="gradient-hero-overlay absolute inset-0" />
        <Link
          to="/groups"
          className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-ink/60 px-3 py-1.5 text-xs font-semibold text-on-image backdrop-blur sm:left-6 sm:top-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Groups
        </Link>
        <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
          <SportTag sport={group.sport} />
          <h1 className="mt-2 text-4xl leading-none text-on-image sm:text-5xl">{group.name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-on-image-muted">
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" /> {group.memberCount.toLocaleString("en-IN")} members
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {group.area}, Kanpur
            </span>
            {group.privacy === "Private" ? (
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4" /> Private group
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-2xl leading-none">About</h2>
            <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>
          </div>
          <Button
            size="lg"
            variant={joined ? "outline" : "primary"}
            className="h-fit shrink-0"
            onClick={toggleMembership}
          >
            {joined ? "Leave Group" : "Join Group"}
          </Button>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl leading-none">
            Members <span className="text-muted-foreground">({group.memberCount})</span>
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {group.members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground">
                  {m.initials}
                </span>
                <span className="text-xs font-semibold">{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl leading-none">Upcoming games from this group</h2>
          <div className="mt-3">
            {games.length === 0 ? (
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                title="No games hosted yet"
                description="Once a member hosts a game for this group, it'll show up here."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {games.map((g) => (
                  <GameCard
                    key={g.id}
                    game={g}
                    joined={joinedGameIds.includes(g.id)}
                    requested={requestedGameIds.includes(g.id)}
                    onJoin={() => handleJoinGame(g.id, g.joinPolicy === "approval")}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}