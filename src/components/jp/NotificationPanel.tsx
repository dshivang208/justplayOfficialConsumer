import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  BellOff,
  BellRing,
  CalendarCheck,
  CheckCheck,
  Gamepad2,
  Headset,
  Megaphone,
  Receipt,
  Tag,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { useNotifications, type AppNotification } from "@/lib/notifications";

type Kind = "support" | "refund" | "booking" | "wallet" | "game" | "group" | "event" | "offer" | "general";

type Meta = {
  kind: Kind;
  title: string;
  body: string;
  to: "/support" | "/bookings" | "/invite" | "/games" | "/groups" | "/events" | "/venues" | null;
  icon: ReactNode;
  tone: string;
};

/** Notifications are plain text, so the type is inferred from the wording to
 *  give each one a title, an icon and somewhere to go when tapped. */
function describe(n: AppNotification): Meta {
  const text = n.message.trim();
  const m = (re: RegExp) => re.test(text);

  const ticket = text.match(/^Support replied on ticket #(\d+):\s*(.*)$/is);
  if (ticket) {
    return {
      kind: "support",
      title: `Support replied · #${ticket[1]}`,
      body: ticket[2] ?? text,
      to: "/support",
      icon: <Headset className="h-4 w-4" />,
      tone: "bg-primary/10 text-primary",
    };
  }
  if (m(/refund/i))
    return { kind: "refund", title: "Refund update", body: text, to: "/bookings", icon: <Receipt className="h-4 w-4" />, tone: "bg-accent/15 text-accent" };
  if (m(/booking|slot|reschedul|cancel|confirmed/i))
    return { kind: "booking", title: "Booking update", body: text, to: "/bookings", icon: <CalendarCheck className="h-4 w-4" />, tone: "bg-primary/10 text-primary" };
  if (m(/credit|wallet|reward|referral|invite|payout/i))
    return { kind: "wallet", title: "Credit & rewards", body: text, to: "/invite", icon: <Wallet className="h-4 w-4" />, tone: "bg-accent/15 text-accent" };
  if (m(/tournament|event/i))
    return { kind: "event", title: "Events", body: text, to: "/events", icon: <Ticket className="h-4 w-4" />, tone: "bg-primary/10 text-primary" };
  if (m(/game|match|join request/i))
    return { kind: "game", title: "Games", body: text, to: "/games", icon: <Gamepad2 className="h-4 w-4" />, tone: "bg-primary/10 text-primary" };
  if (m(/group|member/i))
    return { kind: "group", title: "Groups", body: text, to: "/groups", icon: <Users className="h-4 w-4" />, tone: "bg-primary/10 text-primary" };
  if (m(/offer|discount|coupon|% off|sale/i))
    return { kind: "offer", title: "Offer", body: text, to: "/venues", icon: <Tag className="h-4 w-4" />, tone: "bg-accent/15 text-accent" };
  return { kind: "general", title: "JustPlay", body: text, to: null, icon: <Megaphone className="h-4 w-4" />, tone: "bg-secondary text-secondary-foreground" };
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function groupLabel(iso: string) {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return "This week";
  return "Earlier";
}

/**
 * The notification inbox, shared by the desktop dropdown and the mobile menu:
 * grouped by day, each row with an icon, title, message, time and an unread
 * marker — tapping opens the relevant page.
 */
export function NotificationPanel({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
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
  const [tab, setTab] = useState<"all" | "unread">("all");

  const grouped = useMemo(() => {
    const list = tab === "unread" ? notifications.filter((n) => !n.read) : notifications;
    const out: { label: string; items: AppNotification[] }[] = [];
    for (const n of list) {
      const label = groupLabel(n.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(n);
      else out.push({ label, items: [n] });
    }
    return out;
  }, [notifications, tab]);

  const open = (n: AppNotification, to: Meta["to"]) => {
    if (!n.read) markAsRead(n.id);
    if (to) {
      onNavigate?.();
      void navigate({ to });
    }
  };

  return (
    <div className="flex max-h-[32rem] flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-foreground">Notifications</p>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent">
              {unreadCount} new
            </span>
          ) : null}
        </div>
        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={markAllAsRead}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        ) : null}
      </div>

      <div className="flex gap-1 border-b border-border px-3 py-2">
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <BellOff className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              {tab === "unread" ? "No unread notifications" : "You're all caught up"}
            </p>
            <p className="text-xs text-muted-foreground">
              Booking updates, replies from support and offers will show up here.
            </p>
          </div>
        ) : (
          grouped.map((g) => (
            <section key={g.label}>
              <p className="sticky top-0 bg-surface px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </p>
              <ul className="divide-y divide-border">
                {g.items.map((n) => {
                  const meta = describe(n);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => open(n, meta.to)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 ${
                          n.read ? "" : "bg-primary/5"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.tone}`}
                        >
                          {meta.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span
                              className={`truncate text-sm ${n.read ? "font-medium" : "font-bold"} text-foreground`}
                            >
                              {meta.title}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {timeAgo(n.createdAt)}
                            </span>
                          </span>
                          <span className="mt-0.5 line-clamp-3 block text-[13px] leading-snug text-muted-foreground">
                            {meta.body}
                          </span>
                        </span>
                        {!n.read ? (
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="border-t border-border px-4 py-2.5">
        {pushState === "subscribed" ? (
          <button
            type="button"
            onClick={() => void disablePush()}
            className="text-xs font-semibold text-muted-foreground hover:text-destructive"
          >
            Turn off push notifications on this device
          </button>
        ) : pushState === "unsupported" || pushState === "denied" ? (
          pushError ? <p className="text-xs text-muted-foreground">{pushError}</p> : null
        ) : (
          <>
            <button
              type="button"
              onClick={() =>
                enablePush().catch((e) => {
                  toast.error(e instanceof Error ? e.message : "Could not enable push notifications.");
                })
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <BellRing className="h-3.5 w-3.5" /> Enable push notifications on this device
            </button>
            {pushError ? <p className="mt-1 text-xs text-destructive">{pushError}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
