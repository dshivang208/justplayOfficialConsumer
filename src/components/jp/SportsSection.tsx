import { Link } from "@tanstack/react-router";
import { sports } from "@/data/landing";
import { Section, SectionHeading } from "./SectionHeading";

export function SportsSection() {
  return (
    <Section id="sports">
      <SectionHeading
        eyebrow="Pick your game"
        title="Sports You Love"
        subtitle="Cricket ho ya pickleball — Kanpur ke best turfs aur courts, ek jagah."
      />

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 md:grid-cols-5">
        {sports.map((sport) => (
          <Link
            key={sport.id}
            to="/venues"
            className="surface-card group flex w-28 shrink-0 snap-start flex-col items-center gap-1.5 rounded-2xl px-3 py-4 transition-all hover:-translate-y-1 hover:border-primary sm:w-auto"
          >
            <span className="text-2xl transition-transform group-hover:scale-110">
              {sport.emoji}
            </span>
            <span className="text-sm font-semibold text-foreground">{sport.name}</span>
            <span className="text-[11px] text-muted-foreground">{sport.venueCount} venues</span>
          </Link>
        ))}
      </div>
    </Section>
  );
}
