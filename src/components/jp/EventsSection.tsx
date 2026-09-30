import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Trophy } from "lucide-react";
import type { CommunityEventDetail } from "@/data/community";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";
import { Section, SectionHeading } from "./SectionHeading";
import { EventCard } from "./EventCard";
import { Button } from "./Button";
import { SkeletonGrid, EmptyState } from "./states";

export function EventsSection() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { events, registeredEventIds, registerEvent, loading, hydrated } = useCommunity();
  const [busyId, setBusyId] = useState<string | null>(null);
  const isLoading = loading && !hydrated;
  // Real, live events only — loadEvents() already sorts by soonest date,
  // capped to a homepage preview. No demo/mock rows here; "All events"
  // links to /events for the full, filterable list.
  const upcoming = events.slice(0, 4);

  const handleRegister = async (event: CommunityEventDetail) => {
    // A paid event needs the Razorpay checkout step, which lives on the
    // event's own detail page — a homepage card is the wrong place to open
    // a payment modal. Only free entry / "Register Interest" events
    // register instantly, right from the card.
    if (event.entryFee > 0) {
      void navigate({ to: "/events/$eventId", params: { eventId: event.id } });
      return;
    }
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: "/" } });
      return;
    }
    setBusyId(event.id);
    try {
      await registerEvent(event.id);
      toast.success("You're registered!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't register for this event.");
    } finally {
      setBusyId(null);
    }
  };

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
      ) : upcoming.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-8 w-8" />}
          title="No events scheduled"
          description="New tournaments drop every month. Check back soon."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {upcoming.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              registered={registeredEventIds.includes(ev.id)}
              registering={busyId === ev.id}
              onRegister={() => handleRegister(ev)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}