import { Link } from "@tanstack/react-router";
import { Gift, Ticket, UserPlus } from "lucide-react";
import { Section } from "./SectionHeading";
import { Button } from "./Button";

const perks = [
  { icon: UserPlus, label: "Invite a friend with your code" },
  { icon: Ticket, label: "They book their first slot" },
  { icon: Gift, label: "Dono ko ₹100 off — instantly" },
];

export function ReferralSection() {
  return (
    <Section id="invite">
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-surface p-8 md:p-12">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <span className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-accent">
              <span className="h-px w-6 bg-accent" /> Rewards
            </span>
            <h2 className="text-4xl leading-none sm:text-5xl">
              Invite friends,<span className="text-primary"> get rewarded.</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm text-muted-foreground sm:text-base">
              Har dost jo JustPlay pe khelta hai, aapko ₹100 deta hai. Invite a friend — both of
              you get ₹100 off your next booking.
            </p>
            <Button asChild size="lg" variant="accent" className="mt-7">
              <Link to="/invite">Invite Friends</Link>
            </Button>
          </div>

          <ul className="space-y-3">
            {perks.map((p, i) => (
              <li
                key={p.label}
                className="flex items-center gap-4 rounded-2xl border border-border bg-background/60 px-4 py-3.5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <p.icon className="h-4.5 w-4.5" />
                </span>
                <span className="text-sm font-medium text-foreground">{p.label}</span>
                <span className="ml-auto font-display text-2xl text-muted-foreground">
                  0{i + 1}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
