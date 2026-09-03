import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X, MapPin, CalendarCheck, User, Wallet } from "lucide-react";
import { Button } from "./Button";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";

const links = [
  { label: "Venues", to: "/venues" },
  { label: "Games", to: "/games" },
  { label: "Groups", to: "/groups" },
  { label: "Events", to: "/events" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, isAuthenticated, hydrated } = useAuth();
  const { balance } = useWallet();

  const initials = (user?.name ?? "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="gradient-primary flex h-8 w-8 items-center justify-center rounded-lg font-display text-xl text-primary-foreground">
            J
          </span>
          <span className="font-display text-2xl leading-none tracking-wide">JUSTPLAY</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-primary" /> Kanpur
          </span>
          {hydrated && isAuthenticated ? (
            <>
              <Link
                to="/bookings"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
              >
                <CalendarCheck className="h-4 w-4" /> Bookings
              </Link>
              <Link
                to="/invite"
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-accent/20"
              >
                <Wallet className="h-3.5 w-3.5" /> ₹{balance.toLocaleString("en-IN")} credit
              </Link>
              <Link
                to="/profile"
                aria-label="Your profile"
                className="gradient-primary flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-primary-foreground"
              >
                {initials || <User className="h-4 w-4" />}
              </Link>
            </>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/auth">Log in</Link>
            </Button>
          )}
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open ? (
        <div className="border-t border-border bg-background px-4 pb-5 pt-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            {hydrated && isAuthenticated ? (
              <>
                <Link
                  to="/bookings"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  My Bookings
                </Link>
                <Link
                  to="/invite"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Invite & Rewards
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
                    <Wallet className="h-3 w-3" /> ₹{balance.toLocaleString("en-IN")}
                  </span>
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Profile
                </Link>
              </>
            ) : null}
          </div>
          {hydrated && isAuthenticated ? null : (
            <Button asChild size="md" variant="outline" className="mt-3 w-full">
              <Link to="/auth" onClick={() => setOpen(false)}>
                Log in
              </Link>
            </Button>
          )}
        </div>
      ) : null}
    </header>
  );
}