import { createFileRoute } from "@tanstack/react-router";
import { Compass, Heart, Users } from "lucide-react";
import { PageShell, PageHeader } from "@/components/jp/PageShell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us | JustPlay" },
      {
        name: "description",
        content:
          "JustPlay is Kanpur's sports venue booking and community platform — book a venue, host a game, find your crew.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="About JustPlay"
        title="Kanpur ka apna sports network"
        subtitle="We're building the easiest way for Kanpur to book a venue, fill a game, and find people who show up every week."
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <section>
          <h2 className="text-3xl leading-none">Our Story</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <p>
              JustPlay started from a problem every weekend footballer, box-cricket regular, and
              badminton doubles partner in Kanpur already knows: finding a decent court is easy
              enough, but finding nine other people to show up at 7 AM on a Sunday is the actual
              challenge. Venue owners had empty courts on weekday evenings. Players had group chats
              full of "kaun aa raha hai?" messages that went nowhere.
            </p>
            <p>
              We built JustPlay to close that gap — a single place to see which venues in the city
              actually have a free slot right now, book it in a few taps, and open that game up to
              other players nearby instead of always relying on the same six friends who are always
              busy.
            </p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-3xl leading-none">What We Do</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="surface-card rounded-2xl p-5">
              <Compass className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-lg">Venue Booking</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Real-time slot availability across box cricket, football turfs, badminton and tennis
                courts in Kanpur — no phone calls, no "venue available hai kya" texts.
              </p>
            </div>
            <div className="surface-card rounded-2xl p-5">
              <Users className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-lg">Hosted Games</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Host a game at a venue you've booked and let nearby players fill your empty spots —
                split the cost, set the skill level, and let JustPlay handle who's coming.
              </p>
            </div>
            <div className="surface-card rounded-2xl p-5">
              <Heart className="h-6 w-6 text-primary" />
              <h3 className="mt-3 text-lg">Sports Groups</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Regular crews that play every week — join one that matches your sport and area, and
                stop starting from zero every time you want a game.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-3xl leading-none">Our Vision</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <p>
              We want showing up to play to be the easy part of anyone's week — not the part that
              needs three days of group-chat negotiation. Kanpur is where we're starting because
              it's home, and because a mid-size city like this one is exactly where a good local
              sports network is missing today, sitting between the big metro apps that don't really
              know the area and word-of-mouth that only reaches a handful of people.
            </p>
            <p>
              Longer term, our goal is simple: more courts in use on a Tuesday evening, more people
              who've never met before ending up on the same team on a Sunday morning, and a city
              where "let's play" turns into an actual game a lot more often than it does today.
            </p>
          </div>
        </section>
      </div>
    </PageShell>
  );
}