import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, ArrowRight } from "lucide-react";
import { fetchVenues, type VenueDetail } from "@/data/venues";
import { Section, SectionHeading } from "./SectionHeading";
import { Button } from "./Button";
import { VenueCard } from "./VenueCard";
import { SkeletonGrid, EmptyState } from "./states";

export function VenuesSection() {
  const [venues, setVenues] = useState<VenueDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchVenues().then((v) => {
      if (active) {
        setVenues(v.slice(0, 8));
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Section id="venues" className="bg-surface/30">
      <SectionHeading
        eyebrow="Kanpur"
        title="Venues Near You"
        subtitle="Verified turfs and courts with live pricing. Slot confirm karein in under a minute."
        action={
          <Button asChild variant="outline">
            <Link to="/venues">
              View All Venues <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonGrid count={6} />
      ) : venues.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="No venues here yet"
          description="We're onboarding grounds in this area. Try another part of Kanpur."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {venues.map((v) => (
            <VenueCard key={v.id} venue={v} />
          ))}
        </div>
      )}
    </Section>
  );
}