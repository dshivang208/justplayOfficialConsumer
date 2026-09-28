import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { sports } from "@/data/landing";
import { fetchSportVenueCounts } from "@/data/venues";
import { Section, SectionHeading } from "./SectionHeading";

function countLabel(count: number | undefined) {
  if (count === undefined) return null; // still loading / failed — show nothing rather than a wrong number
  if (count === 0) return "Coming soon";
  return `${count} ${count === 1 ? "venue" : "venues"}`;
}

export function SportsSection() {
  // null = not loaded yet; {} = loaded (or failed) with no data.
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let active = true;
    fetchSportVenueCounts().then((c) => {
      if (active) setCounts(c);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Section id="sports">
      <SectionHeading
        eyebrow="Pick your game"
        title="Sports You Love"
        subtitle="Cricket ho ya pickleball — Kanpur ke best turfs aur courts, ek jagah."
      />

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 md:grid-cols-5">
        {sports.map((sport) => {
          const label = counts === null ? null : countLabel(counts[sport.name] ?? 0);
          return (
            <Link
              key={sport.id}
              to="/venues"
              search={{ sport: sport.name }}
              className="surface-card group flex w-28 shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl px-3 py-4 transition-all hover:-translate-y-1 hover:border-primary sm:w-auto"
            >
              <span className="text-2xl transition-transform group-hover:scale-110">
                {sport.emoji}
              </span>
              <span className="text-sm font-semibold text-foreground">{sport.name}</span>
              {/* Fixed-height slot so cards don't jump when the count arrives */}
              <span className="h-4 text-[11px] text-muted-foreground">{label}</span>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}