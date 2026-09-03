import { Link } from "@tanstack/react-router";
import { Instagram, Mail, MapPin, Phone } from "lucide-react";
import { cities } from "@/data/landing";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface/40">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Link to="/" className="flex items-center gap-2">
            <span className="gradient-primary flex h-8 w-8 items-center justify-center rounded-lg font-display text-xl text-primary-foreground">
              J
            </span>
            <span className="font-display text-2xl leading-none tracking-wide">JUSTPLAY</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Kanpur ka apna sports network. Book venues, host games, and find your crew — sab ek
            jagah.
          </p>
          <div className="mt-5 flex gap-3">
            {[Instagram, Mail, Phone].map((Icon, i) => (
              <a
                key={i}
                href="#"
                aria-label="JustPlay social link"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg">Company</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <a href="#" className="hover:text-primary">
                About
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-primary">
                Contact
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-primary">
                List your venue
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-primary">
                Privacy & Terms
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg">Cities</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {cities.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {c.name}
                {c.live ? (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                    Live
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-wide">Coming soon</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-border px-4 py-5 sm:px-6">
        <p className="mx-auto w-full max-w-6xl text-xs text-muted-foreground">
          © {new Date().getFullYear()} JustPlay Sports Pvt. Ltd. · Made in Kanpur, India.
        </p>
      </div>
    </footer>
  );
}
