import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Lock, MapPin, Users, Check, X } from "lucide-react";
import { PageShell } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { SportTag } from "@/components/jp/SportTag";
import { GameCard } from "@/components/jp/GameCard";
import { GroupChat } from "@/components/jp/GroupChat";
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
    approveGroupJoinRequest,
    rejectGroupJoinRequest,
    gamesForGroup,
    joinedGameIds,
    requestedGameIds,
    joinGame,
    requestJoin,
    loading,
  } = useCommunity();

  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);

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
  const isAdmin = group.myRole === "admin";

  const handleJoinClick = async () => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: `/groups/${group.id}` } });
      return;
    }
    try {
      const status = await joinGroup(group.id);
      toast.success(
        status === "pending" ? "Request sent to the group admin" : "You're in the group!",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join this group. Try again.");
    }
  };

  const handleLeaveConfirmed = async () => {
    try {
      await leaveGroup(group.id);
      toast.success("You've left the group");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't leave this group. Try again.");
    } finally {
      setConfirmLeave(false);
    }
  };

  const handleApprove = async (userId: string) => {
    setBusyRequestId(userId);
    try {
      await approveGroupJoinRequest(group.id, userId);
      toast.success("Request approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't approve this request.");
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleReject = async (userId: string) => {
    setBusyRequestId(userId);
    try {
      await rejectGroupJoinRequest(group.id, userId);
      toast.success("Request rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reject this request.");
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleJoinGame = async (gameId: string, approvalNeeded: boolean) => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: `/groups/${group.id}` } });
      return;
    }
    try {
      if (approvalNeeded) {
        await requestJoin(gameId);
        toast.success("Request sent to the host");
      } else {
        await joinGame(gameId);
        toast.success("You're in! Spot confirmed.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join this game. Try again.");
    }
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
            onClick={joined ? () => setConfirmLeave(true) : handleJoinClick}
          >
            {joined ? "Leave Group" : "Join Group"}
          </Button>
        </div>

        {isAdmin && group.pendingRequests.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-2xl leading-none">
              Pending Requests{" "}
              <span className="text-muted-foreground">({group.pendingRequests.length})</span>
            </h2>
            <div className="mt-3 space-y-2">
              {group.pendingRequests.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[11px] font-bold">
                        {p.initials}
                      </span>
                    )}
                    <span className="text-sm font-semibold">{p.name}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={busyRequestId === p.id}
                      onClick={() => handleReject(p.id)}
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={busyRequestId === p.id}
                      onClick={() => handleApprove(p.id)}
                    >
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
                {m.photoUrl ? (
                  <img src={m.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-bold text-foreground">
                    {m.initials}
                  </span>
                )}
                <span className="text-xs font-semibold">{m.name}</span>
              </div>
            ))}
          </div>
        </div>

        {joined ? (
          <div className="mt-8">
            <h2 className="text-2xl leading-none">Group Chat</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Only visible to members of this group.
            </p>
            <div className="mt-3">
              <GroupChat groupId={group.id} />
            </div>
          </div>
        ) : null}

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

      {confirmLeave ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 text-center">
            <h2 className="text-xl leading-none">Leave {group.name}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You'll stop seeing this group's chat and hosted games unless you rejoin.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmLeave(false)}>
                Stay in group
              </Button>
              <Button
                className="flex-1 bg-destructive text-destructive-foreground hover:brightness-110"
                onClick={handleLeaveConfirmed}
              >
                Leave group
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}