import { Link } from "@tanstack/react-router";
import { ArrowRight, Users } from "lucide-react";
import { groups } from "@/data/landing";
import { Section, SectionHeading } from "./SectionHeading";
import { Button } from "./Button";
import { SportTag } from "./SportTag";
import { SkeletonGrid, EmptyState } from "./states";

export function GroupsSection({ isLoading = false }: { isLoading?: boolean }) {
  return (
    <Section id="groups">
      <SectionHeading
        eyebrow="Your people"
        title="Groups"
        subtitle="Regular crews that play every week. Join one and never look for players again."
        action={
          <Button asChild variant="outline">
            <Link to="/groups">
              Explore Groups <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonGrid count={4} className="lg:grid-cols-4" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No groups yet"
          description="Start the first sports community in your area."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((group) => (
            <Link
              key={group.id}
              to="/groups"
              className="surface-card group relative flex min-h-52 flex-col justify-end overflow-hidden rounded-2xl p-4 transition-all hover:-translate-y-1 hover:border-primary/60"
            >
              <img
                src={group.image}
                alt={`${group.name} community in Kanpur`}
                loading="lazy"
                width={1024}
                height={640}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="gradient-card-overlay absolute inset-0" />
                <div className="relative">
                  <SportTag sport={group.sport} />
                  <h3 className="mt-2 text-lg leading-tight text-on-image">{group.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-on-image-muted">{group.blurb}</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-on-image">
                  <Users className="h-3.5 w-3.5" />
                  {group.members.toLocaleString("en-IN")} members
                </p>

              </div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}
