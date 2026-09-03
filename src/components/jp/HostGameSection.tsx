import { Link } from "@tanstack/react-router";
import { CalendarCheck, Share2, Users2 } from "lucide-react";
import { featuredHostedGame } from "@/data/landing";
import { Section } from "./SectionHeading";
import { Button } from "./Button";
import { HostedGameCard } from "./HostedGameCard";

const steps = [
  {
    icon: CalendarCheck,
    title: "Pick a slot",
    copy: "Choose your venue, sport and time. Pay only your share upfront.",
  },
  {
    icon: Share2,
    title: "Invite your circle",
    copy: "Share one link on WhatsApp — friends and nearby players can join.",
  },
  {
    icon: Users2,
    title: "Fill the squad",
    copy: "Spots fill up from the JustPlay community. Numbers kam? Koi baat nahi.",
  },
];

export function HostGameSection() {
  return (
    <Section id="host">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <span className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="h-px w-6 bg-primary" /> Host a Game
          </span>
          <h2 className="text-4xl leading-none sm:text-5xl md:text-6xl">
            Team adhoori hai?
            <br />
            <span className="text-primary">Host karo</span>, baaki hum bhar denge.
          </h2>
          <p className="mt-4 max-w-lg text-sm text-muted-foreground sm:text-base">
            Book a slot, open it up to players near you, and split the cost per head. No group
            chat chaos, no last-minute cancellations.
          </p>

          <div className="mt-8 space-y-5">
            {steps.map((s) => (
              <div key={s.title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <s.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-lg leading-tight">{s.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{s.copy}</p>
                </div>
              </div>
            ))}
          </div>

          <Button asChild size="lg" className="mt-8">
            <Link to="/host">Host a Game</Link>
          </Button>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-full bg-primary/10 blur-3xl" />
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Example hosted game
          </p>
          <HostedGameCard game={featuredHostedGame} />
        </div>
      </div>
    </Section>
  );
}
