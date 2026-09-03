import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, MapPin, Trophy } from "lucide-react";
import { events } from "@/data/landing";
import { Section, SectionHeading } from "./SectionHeading";
import { Button } from "./Button";
import { SportTag } from "./SportTag";
import { SkeletonGrid, EmptyState } from "./states";

export function EventsSection({ isLoading = false }: { isLoading?: boolean }) {
  return (
    <Section id="events" className="bg-surface/30">
      <SectionHeading
        eyebrow="Compete"
        title="Events & Tournaments"
        subtitle="Local leagues, weekend cups and coaching camps happening across Kanpur."
        action={
          <Button asChild variant="outline">
            <Link to="/events">
              All events <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonGrid count={4} className="lg:grid-cols-4" />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-8 w-8" />}
          title="No events scheduled"
          description="New tournaments drop every month. Check back soon."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {events.map((ev) => (
            <article
              key={ev.id}
              className="surface-card flex flex-col overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:border-primary/60"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <img
                  src={ev.image}
                  alt={`${ev.title} at ${ev.venueName}`}
                  loading="lazy"
                  width={1024}
                  height={640}
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-3 top-3">
                  <SportTag sport={ev.sport} />
                </span>

              </div>

              <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                <h3 className="text-base leading-tight">{ev.title}</h3>
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" /> {ev.date}
                </p>
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {ev.venueName}
                </p>
                <div className="mt-auto space-y-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground">{ev.entryFee}</span>
                    <span className="text-accent">{ev.slotsLeft} slots left</span>
                  </div>
                  <Button size="sm" variant="surface" className="w-full">
                    Register Interest
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </Section>
  );
}
