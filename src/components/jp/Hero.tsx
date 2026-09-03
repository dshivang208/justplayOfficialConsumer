import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, MapPin, CalendarDays, ChevronDown, Zap } from "lucide-react";
import heroImage from "@/assets/hero-turf.jpg";
import { areas, cities, sports } from "@/data/landing";
import { Button } from "./Button";

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-surface px-4 py-3 text-left transition-colors focus-within:bg-surface-raised md:rounded-none md:bg-transparent md:py-2 md:focus-within:bg-transparent">
      <span className="text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {children}
      </span>
    </label>
  );
}

const selectClass =
  "w-full appearance-none bg-transparent pr-4 text-sm font-semibold text-foreground outline-none";

export function Hero() {
  const [city, setCity] = useState("kanpur");
  const [sport, setSport] = useState("");
  const [area, setArea] = useState("");
  const [date, setDate] = useState("");

  return (
    <section className="relative overflow-hidden">
      <img
        src={heroImage}
        alt="Floodlit football turf in Kanpur at night"
        width={1536}
        height={1024}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="gradient-hero-overlay absolute inset-0" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-14 pt-20 sm:px-6 md:pb-24 md:pt-32">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-on-image/30 bg-ink/50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-on-image backdrop-blur">
            <Zap className="h-3.5 w-3.5" /> Now live in Kanpur
          </span>

          <h1 className="mt-5 text-5xl leading-[0.92] text-on-image drop-shadow-[0_2px_18px_rgba(0,0,0,0.45)] sm:text-7xl md:text-8xl">
            Khali slot mat<span className="text-primary"> chhodo.</span>
            <br />
            Game on karo.
          </h1>

          <p className="mt-5 max-w-lg text-base text-on-image-muted sm:text-lg">
            Book turfs and courts across Kanpur, host your own game, and find players who show
            up. Ek app, poora sporting circle.
          </p>
        </div>


        {/* Search bar */}
        <div className="mt-9 rounded-2xl border border-border bg-background/95 p-3 shadow-[var(--shadow-card)] backdrop-blur-xl md:p-2.5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:divide-x md:divide-border">
            <Field icon={<MapPin className="h-4 w-4" />} label="City">
              <div className="relative flex items-center">
                <select
                  className={selectClass}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.live}>
                      {c.name}
                      {c.live ? "" : " — coming soon"}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none -ml-3 h-4 w-4 text-muted-foreground" />
              </div>
            </Field>

            <Field icon={<Search className="h-4 w-4" />} label="Sport">
              <div className="relative flex items-center">
                <select
                  className={selectClass}
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                >
                  <option value="">Any sport</option>
                  {sports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none -ml-3 h-4 w-4 text-muted-foreground" />
              </div>
            </Field>

            <Field icon={<MapPin className="h-4 w-4" />} label="Area">
              <div className="relative flex items-center">
                <select
                  className={selectClass}
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                >
                  <option value="">All of Kanpur</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none -ml-3 h-4 w-4 text-muted-foreground" />
              </div>
            </Field>

            <Field icon={<CalendarDays className="h-4 w-4" />} label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-sm font-semibold text-foreground outline-none"
              />
            </Field>

            <div className="md:pl-2">
              <Button asChild size="lg" className="w-full md:w-auto">
                <Link to="/venues">Find a Venue</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="md" className="border-on-image/40 bg-ink/40 text-on-image backdrop-blur hover:bg-ink/60">
            <Link to="/host">Host a Game</Link>
          </Button>
          <p className="text-xs text-on-image-muted">
            120+ slots booked in Kanpur this week
          </p>
        </div>

      </div>
    </section>
  );
}
