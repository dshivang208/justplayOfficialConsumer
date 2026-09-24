import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell, Menu, X, MapPin, CalendarCheck, User, Wallet } from "lucide-react";
import { Button } from "./Button";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";
import { useNotifications } from "@/lib/notifications";

const links = [
  { label: "Venues", to: "/venues" },
  { label: "Games", to: "/games" },
  { label: "Groups", to: "/groups" },
  { label: "Events", to: "/events" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { user, isAuthenticated, hydrated } = useAuth();
  const { balance } = useWallet();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    pushState,
    pushError,
    enablePush,
    disablePush,
  } = useNotifications();

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
                  <div className="absolute right-0 top-11 w-80 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                    <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                      <p className="text-sm font-semibold text-foreground">Notifications</p>
                      {unreadCount > 0 ? (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Mark all read
                        </button>
                      ) : null}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
                        <Bell className="h-5 w-5 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">You're all caught up.</p>
                      </div>
                    ) : (
                      <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto">
                        {notifications.map((n) => (
                          <li key={n.id}>
                            <button
                              onClick={() => markAsRead(n.id)}
                              className={`flex w-full items-start gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-secondary/60 ${
                                n.read ? "" : "bg-primary/5"
                              }`}
                            >
                              {!n.read ? (
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                              ) : (
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />
                              )}
                              <span className="text-sm text-foreground">{n.message}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="border-t border-border px-3.5 py-2.5">
                      {pushState === "subscribed" ? (
                        <button
                          onClick={() => void disablePush()}
                          className="text-xs font-semibold text-muted-foreground hover:text-destructive"
                        >
                          Turn off push notifications on this device
                        </button>
                      ) : pushState === "unsupported" || pushState === "denied" ? (
                        <p className="text-xs text-muted-foreground">{pushError}</p>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              enablePush().catch((e) => {
                                toast.error(
                                  e instanceof Error
                                    ? e.message
                                    : "Could not enable push notifications.",
                                );
                              })
                            }
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            Enable push notifications on this device
                          </button>
                          {pushError ? (
                            <p className="mt-1 text-xs text-destructive">{pushError}</p>
                          ) : null}
                        </>
                      )}
                    </div>
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
                <button
                  onClick={() => {
                    markAllAsRead();
                    setNotificationsOpen((v) => !v);
                  }}
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
                {notificationsOpen && notifications.length > 0 ? (
                  <ul className="mb-1 flex flex-col divide-y divide-border rounded-lg border border-border">
                    {notifications.slice(0, 5).map((n) => (
                      <li key={n.id} className="px-3 py-2 text-xs text-muted-foreground">
                        {n.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
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