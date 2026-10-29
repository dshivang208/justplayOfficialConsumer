import { useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LifeBuoy, Bell, Menu, X, MapPin, CalendarCheck, User, Wallet, LogOut } from "lucide-react";
import { Button } from "./Button";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";
import { useNotifications } from "@/lib/notifications";
import { NotificationPanel } from "./NotificationPanel";

const links = [
  { label: "Venues", to: "/venues" },
  { label: "Games", to: "/games" },
  { label: "Groups", to: "/groups" },
  { label: "Events", to: "/events" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, isAuthenticated, hydrated, logout } = useAuth();
  const { balance } = useWallet();
  const { unreadCount } = useNotifications();

  // Mobile menu closes on: navigation, Escape, and a tap anywhere outside it (see backdrop below).
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
              <div className="relative">
                <button
                  onClick={() => setNotificationsOpen((v) => !v)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label={
                    unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"
                  }
                >
                  <Bell className="h-4.5 w-4.5" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent ring-2 ring-background" />
                  ) : null}
                </button>
                {notificationsOpen ? (
                  <div className="absolute right-0 top-11 z-50 w-[24rem] overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
                    <NotificationPanel onNavigate={() => setNotificationsOpen(false)} />
                  </div>
                ) : null}
              </div>
              <Link
                to="/bookings"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
              >
                <CalendarCheck className="h-4 w-4" /> Bookings
              </Link>
              <Link
                to="/support"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
              >
                <LifeBuoy className="h-4 w-4" /> Support
              </Link>
              <Link
                to="/invite"
                className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-accent/20"
              >
                <Wallet className="h-3.5 w-3.5" /> {balance.toLocaleString("en-IN")} pts
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
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="absolute inset-x-0 top-full -z-10 h-screen bg-ink/40 backdrop-blur-[1px] md:hidden"
        />
      ) : null}

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
                <button
                  onClick={() => setNotificationsOpen((v) => !v)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Bell className="h-4 w-4" /> Notifications
                  </span>
                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
                      {unreadCount}
                    </span>
                  ) : null}
                </button>
                {notificationsOpen ? (
                  <div className="mb-1 overflow-hidden rounded-xl border border-border">
                    <NotificationPanel
                      onNavigate={() => {
                        setNotificationsOpen(false);
                        setOpen(false);
                      }}
                    />
                  </div>
                ) : null}
                <Link
                  to="/bookings"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  My Bookings
                </Link>
                <Link
                  to="/support"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Help & Support
                </Link>
                <Link
                  to="/invite"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Invite & Rewards
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-bold text-accent">
                    <Wallet className="h-3 w-3" /> {balance.toLocaleString("en-IN")} pts
                  </span>
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    logout();
                    void navigate({ to: "/", replace: true });
                  }}
                  className="mt-1 flex items-center gap-2 border-t border-border px-3 pb-2.5 pt-3.5 text-left text-sm font-semibold text-destructive hover:bg-destructive/5"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
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