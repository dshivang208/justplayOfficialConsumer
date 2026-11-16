import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Compass, Heart, MapPin, Users, Zap, Wallet, CalendarCheck } from "lucide-react";
import { PageShell } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import heroImg from "@/assets/hero-turf.jpg";
import storyImg from "@/assets/venue-boxcricket.jpg";
import bookingImg from "@/assets/venue-badminton.jpg";
import gamesImg from "@/assets/group-football.jpg";
import groupsImg from "@/assets/group-cricket.jpg";
import visionImg from "@/assets/event-tournament.jpg";

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

const highlights = [
  { icon: MapPin, label: "Made in Kanpur", copy: "Built for the city's courts & turfs" },
  { icon: CalendarCheck, label: "Live slots", copy: "Real-time availability, instant booking" },
  { icon: Wallet, label: "Split the cost", copy: "Pay only your share per head" },
  { icon: Zap, label: "Fill your squad", copy: "Nearby players join your game" },
];

const pillars = [
  {
    icon: Compass,
    img: bookingImg,
    title: "Venue Booking",
    copy: "Real-time slot availability across box cricket, football turfs, badminton and tennis courts in Kanpur — no phone calls, no “venue available hai kya” texts.",
  },
  {
    icon: Users,
    img: gamesImg,
    title: "Hosted Games",
    copy: "Host a game at a venue you've booked and let nearby players fill your empty spots — split the cost, set the skill level, and let JustPlay handle who's coming.",
  },
  {
    icon: Heart,
    img: groupsImg,
    title: "Sports Groups",
    copy: "Regular crews that play every week — join one that matches your sport and area, and stop starting from zero every time you want a game.",
  },
];

function AboutPage() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img
          src={heroImg}
          alt="Floodlit football turf"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/60 to-ink/85" />
        <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-16 sm:px-6 md:pb-32 md:pt-24">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-on-image-muted">
            <span className="h-px w-6 bg-on-image-muted" /> About JustPlay
          </span>
          <h1 className="mt-4 max-w-3xl text-5xl leading-[0.95] text-on-image sm:text-6xl md:text-7xl">
            Kanpur ka apna <span className="text-primary">sports network</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-on-image-muted sm:text-lg">
            We're building the easiest way for Kanpur to book a venue, fill a game, and find
            people who show up every week.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/venues">
                Book a venue <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-on-image/40 bg-ink/40 text-on-image backdrop-blur hover:bg-ink/60"
            >
              <Link to="/host">Host a game</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Highlights — overlaps the hero */}
      <div className="relative z-10 mx-auto -mt-14 w-full max-w-6xl px-4 sm:px-6">
        <div className="surface-card grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border shadow-lg lg:grid-cols-4">
          {highlights.map((h) => (
            <div key={h.label} className="bg-background p-4 sm:p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <h.icon className="h-4.5 w-4.5" />
              </span>
              <p className="mt-3 text-sm font-bold text-foreground">{h.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{h.copy}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Story */}
      <section className="mx-auto mt-16 grid w-full max-w-6xl items-center gap-8 px-4 sm:px-6 md:mt-24 md:grid-cols-2 md:gap-12">
        <div className="relative">
          <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-primary/10 blur-2xl" />
          <img
            src={storyImg}
            alt="Players on a box cricket turf"
            loading="lazy"
            className="aspect-[4/3] w-full rounded-2xl object-cover shadow-lg"
          />
        </div>
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="h-px w-6 bg-primary" /> Our Story
          </span>
          <h2 className="mt-2 text-3xl leading-none sm:text-4xl">
            Nine players, one empty court, zero replies
          </h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <p>
              JustPlay started from a problem every weekend footballer, box-cricket regular, and
              badminton doubles partner in Kanpur already knows: finding a decent court is easy
              enough, but finding nine other people to show up at 7 AM on a Sunday is the actual
              challenge. Venue owners had empty courts on weekday evenings. Players had group chats
              full of “kaun aa raha hai?” messages that went nowhere.
            </p>
            <p>
              We built JustPlay to close that gap — a single place to see which venues in the city
              actually have a free slot right now, book it in a few taps, and open that game up to
              other players nearby instead of always relying on the same six friends who are always
              busy.
            </p>
          </div>
        </div>
      </section>

      {/* What we do */}
      <section className="mt-16 bg-surface/40 py-14 md:mt-24 md:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="h-px w-6 bg-primary" /> What We Do
          </span>
          <h2 className="mt-2 text-3xl leading-none sm:text-4xl">Everything you need to play</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {pillars.map((p) => (
              <article
                key={p.title}
                className="surface-card group overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:border-primary/60"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={p.img}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
                  <span className="gradient-primary absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-xl text-primary-foreground shadow-md">
                    <p.icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="text-xl leading-tight">{p.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{p.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Vision */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 md:gap-12 md:py-24">
        <div className="order-2 md:order-1">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <span className="h-px w-6 bg-primary" /> Our Vision
          </span>
          <h2 className="mt-2 text-3xl leading-none sm:text-4xl">
            Showing up to play should be the easy part
          </h2>
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
              where “let's play” turns into an actual game a lot more often than it does today.
            </p>
          </div>
        </div>
        <div className="relative order-1 md:order-2">
          <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-accent/10 blur-2xl" />
          <img
            src={visionImg}
            alt="A local sports tournament"
            loading="lazy"
            className="aspect-[16/10] w-full rounded-2xl object-cover shadow-lg"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-16 sm:px-6 md:pb-24">
        <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl">
          <img
            src={gamesImg}
            alt=""
            loading="lazy"
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/90 via-ink/75 to-ink/50" />
          <div className="px-6 py-12 sm:px-12 md:py-16">
            <h2 className="max-w-xl text-3xl leading-none text-on-image sm:text-5xl">
              Ready for your next game?
            </h2>
            <p className="mt-3 max-w-md text-sm text-on-image-muted sm:text-base">
              Book a slot, host a match, or join a crew — it takes a few taps.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/venues">Explore venues</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-on-image/40 bg-ink/40 text-on-image backdrop-blur hover:bg-ink/60"
              >
                <Link to="/contact">Get in touch</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
