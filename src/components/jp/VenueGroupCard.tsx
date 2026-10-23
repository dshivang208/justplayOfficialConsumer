import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/jp/Button";
import { useAuth } from "@/lib/auth";
import { fetchVenueGroup, type VenueGroup } from "@/lib/venueGroup";
import { JustPlayMark } from "./JustPlayMark";

/**
 * Summary card for the venue's optional community group, shown on that
 * venue's detail page only. The chat itself lives on its own page
 * (/venue-group/$venueId). Renders NOTHING unless the venue has a live group
 * (admin enabled the facility + owner created it + not paused).
 */
export function VenueGroupCard({ venueId, venueName }: { venueId: string; venueName: string }) {
  const { user } = useAuth();
  const [group, setGroup] = useState<VenueGroup | null>(null);
  const userId = user?.id ?? null;

  // Re-run on sign-in/out: `is_member` depends on who's asking.
  useEffect(() => {
    let active = true;
    void fetchVenueGroup(venueId).then((g) => {
      if (active) setGroup(g);
    });
    return () => {
      active = false;
    };
  }, [venueId, userId]);

  if (!group) return null;

  return (
    <section className="surface-card rounded-2xl p-4 sm:p-5" aria-label={`${venueName} group`}>
      <Link
        to="/venue-group/$venueId"
        params={{ venueId }}
        className="flex items-center gap-3 sm:gap-4"
      >
        <JustPlayMark className="h-12 w-12 text-2xl" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl leading-none">{group.name}</h2>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"} · group by{" "}
            {venueName}
          </p>
          {group.description ? (
            <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{group.description}</p>
          ) : null}
        </div>
        <Button asChild size="sm" className="shrink-0">
          <span>
            {group.isMember ? "Open chat" : "View group"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </span>
        </Button>
      </Link>
    </section>
  );
}
