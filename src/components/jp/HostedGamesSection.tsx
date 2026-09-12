import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Users } from "lucide-react";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";
import { Section, SectionHeading } from "./SectionHeading";
import { GameCard } from "./GameCard";
import { ManageGameModal } from "./ManageGameModal";
import { Button } from "./Button";
import { SkeletonGrid, EmptyState } from "./states";

export function HostedGamesSection() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const {
    games,
    joinedGameIds,
    requestedGameIds,
    joinGame,
    requestJoin,
    cancelGame,
    loading,
    hydrated,
  } = useCommunity();
  const [manageGameId, setManageGameId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const manageGame = manageGameId ? (games.find((g) => g.id === manageGameId) ?? null) : null;

  // Real, live hosted games only — soonest first, capped to a homepage
  // preview. No demo/mock rows here; "See all games" links to /games for
  // the full, filterable list.
  const upcoming = games.filter((g) => g.status === "active").slice(0, 4);

  const isLoading = loading && !hydrated;

  const handleJoin = async (gameId: string, approvalNeeded: boolean) => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: "/" } });
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
    <Section id="games" className="bg-surface/30">
      <SectionHeading
        eyebrow="Community"
        title="Hosted Games Near You"
        subtitle="Games already booked by players in Kanpur. Ek spot lo aur pahunch jao."
        action={
          <Button asChild variant="outline">
            <Link to="/games">
              See all games <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonGrid count={4} className="lg:grid-cols-2 xl:grid-cols-2" />
      ) : upcoming.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No games nearby right now"
          description="Be the first — host a game and let players in Kanpur join you."
          action={
            <Button asChild>
              <Link to="/host">Host Karo</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {upcoming.map((g) => (
            <GameCard
              key={g.id}
              game={g}
              joined={joinedGameIds.includes(g.id)}
              requested={requestedGameIds.includes(g.id)}
              onJoin={() => handleJoin(g.id, g.joinPolicy === "approval")}
              onManage={() => setManageGameId(g.id)}
            />
          ))}
        </div>
      )}

      {manageGame ? (
        <ManageGameModal
          game={manageGame}
          onClose={() => setManageGameId(null)}
          onRequestCancel={() => setConfirmCancel(true)}
        />
      ) : null}

      {confirmCancel && manageGame ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 text-center">
            <h2 className="text-xl leading-none">Cancel this game?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Joined players will be notified and this game will be removed from public discovery.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmCancel(false)}>
                Keep it
              </Button>
              <Button
                className="flex-1 bg-destructive text-destructive-foreground hover:brightness-110"
                onClick={async () => {
                  try {
                    await cancelGame(manageGame.id);
                    toast.success("Game cancelled");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Couldn't cancel this game.");
                  } finally {
                    setConfirmCancel(false);
                    setManageGameId(null);
                  }
                }}
              >
                Cancel game
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Section>
  );
}