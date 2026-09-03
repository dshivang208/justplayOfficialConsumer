import { Link } from "@tanstack/react-router";
import { ArrowRight, Users } from "lucide-react";
import { hostedGames } from "@/data/landing";
import { Section, SectionHeading } from "./SectionHeading";
import { HostedGameCard } from "./HostedGameCard";
import { Button } from "./Button";
import { SkeletonGrid, EmptyState } from "./states";

export function HostedGamesSection({ isLoading = false }: { isLoading?: boolean }) {
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
      ) : hostedGames.length === 0 ? (
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
          {hostedGames.map((g) => (
            <HostedGameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </Section>
  );
}