import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import { pushConfigured } from "@/lib/push";

const KEY = "jp_notif_prompt_snoozed_at";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function snoozed(): boolean {
  try {
    const t = Number(localStorage.getItem(KEY) ?? 0);
    return Boolean(t) && Date.now() - t < SNOOZE_MS;
  } catch {
    return false;
  }
}

/** Asks (once a week at most) whether to allow notifications when the app is opened.
 *  The browser's own permission dialog needs a tap, so this is the friendly step before it. */
export function NotificationPrompt() {
  const { isAuthenticated } = useAuth();
  const { pushState, enablePush } = useNotifications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushConfigured || pushState !== "default" || snoozed()) return;
    const t = setTimeout(() => setOpen(true), 2500);
    return () => clearTimeout(t);
  }, [pushState]);

  // Closes itself if permission changes elsewhere (e.g. via the bell panel).
  useEffect(() => {
    if (pushState !== "default") setOpen(false);
  }, [pushState]);

  if (!open) return null;

  const snooze = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const allow = async () => {
    setBusy(true);
    try {
      if (isAuthenticated) {
        await enablePush();
        toast.success("Notifications are on");
      } else {
        // Guest: ask the browser now; the token attaches to the account as soon as they log in.
        const res = await Notification.requestPermission();
        if (res === "granted") toast.success("Great — log in to start getting notifications");
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not turn on notifications.");
      snooze();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[360px]">
      <div className="surface-card relative rounded-2xl border-primary/30 bg-background p-4 shadow-2xl">
        <button
          type="button"
          onClick={snooze}
          aria-label="Dismiss"
          className="absolute right-2.5 top-2.5 rounded-full p-1 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <span className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">Stay in the game</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Get alerts for bookings, game invites and group messages.
            </p>
          </div>
        </div>
        <div className="mt-3.5 flex gap-2">
          <button
            type="button"
            onClick={() => void allow()}
            disabled={busy}
            className="gradient-primary h-9 flex-1 rounded-full text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Please wait…" : "Allow notifications"}
          </button>
          <button
            type="button"
            onClick={snooze}
            className="h-9 rounded-full border border-border px-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
