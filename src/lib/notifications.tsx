/**
 * Real notification inbox — backed by `user_notifications` (added by the
 * admin app's notification-delivery migration), which is populated when
 * an admin sends a broadcast with the "In-app notification" channel
 * checked. RLS scopes every row to its own user; marking read is the
 * only client write allowed.
 *
 * Polls every 45s rather than a realtime subscription — simple, and
 * fine for something a user checks occasionally rather than a live chat.
 *
 * Also owns real Web Push subscription (RFC 8030 + VAPID) — registering
 * the service worker (public/sw.js), asking browser permission, and
 * saving the resulting subscription to `push_subscriptions` so the admin
 * app's send function can actually push to this browser. This is genuine
 * browser/OS-level push (works even with no tab open), not a simulation
 * — but it's the Web Push standard, not FCM/APNs, since this is a web
 * app with no native mobile client to hold a device token.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabaseClient";

export type AppNotification = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type PushPermissionState = "unsupported" | "default" | "denied" | "subscribed";

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  pushState: PushPermissionState;
  /** Why enablePush last failed, or why pushState is "unsupported" — null
   *  when there's nothing to report. Shown directly in the UI now,
   *  rather than only ever going to console.error, so a failure is
   *  something the user can actually see and act on. */
  pushError: string | null;
  enablePush: () => Promise<void>;
  disablePush: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

type Row = { id: string; message: string; created_at: string; read_at: string | null };

const POLL_INTERVAL_MS = 45_000;

/** The Push API wants the VAPID public key as a raw Uint8Array, not the
 *  base64url string it's distributed as. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/** Null means supported. Checked in a specific order so the message
 *  points at the actual blocking reason rather than a generic
 *  "unsupported" — the secure-context check in particular is the most
 *  likely real cause when testing from a LAN IP or a non-localhost dev
 *  hostname over plain HTTP (plain http://localhost itself IS treated as
 *  a secure context by browsers, so that specific case is fine). */
function pushUnsupportedReason(): string | null {
  if (typeof window === "undefined") return null; // SSR pass — not a real answer either way
  if (!window.isSecureContext) {
    return "Push notifications need HTTPS (http://localhost itself is fine, but a LAN IP or other hostname over plain HTTP is not).";
  }
  if (!("serviceWorker" in navigator)) return "This browser doesn't support service workers.";
  if (!("PushManager" in window)) return "This browser doesn't support push notifications.";
  return null;
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pushState, setPushState] = useState<PushPermissionState>("default");
  const [pushError, setPushError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const { data, error } = await supabase
      .from("user_notifications")
      .select("id, message, created_at, read_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<Row[]>();

    if (error) {
      console.error("fetch user_notifications failed:", error.message);
      return;
    }
    setNotifications(
      (data ?? []).map((row) => ({
        id: row.id,
        message: row.message,
        createdAt: row.created_at,
        read: row.read_at !== null,
      })),
    );
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    void refresh().finally(() => setLoading(false));

    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isAuthenticated, refresh]);

  // Reflect whatever the browser/this device already knows, on load —
  // e.g. a subscription made in an earlier session, or the user having
  // denied the permission prompt previously.
  useEffect(() => {
    const reason = pushUnsupportedReason();
    if (reason) {
      setPushState("unsupported");
      setPushError(reason);
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      setPushError("Notifications are blocked for this site in your browser settings.");
      return;
    }
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setPushState(sub ? "subscribed" : "default"))
      .catch(() => setPushState("default"));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("mark notification read failed:", error.message);
      });
  }, []);

  const markAllAsRead = useCallback(() => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    void supabase
      .from("user_notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(({ error }) => {
        if (error) console.error("mark all notifications read failed:", error.message);
      });
  }, [notifications, user]);

  const enablePush = useCallback(async () => {
    setPushError(null);
    try {
      if (!user) throw new Error("Sign in first.");
      const unsupportedReason = pushUnsupportedReason();
      if (unsupportedReason) throw new Error(unsupportedReason);

      const vapidPublicKey = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;
      if (!vapidPublicKey) {
        throw new Error(
          "Push isn't configured on this deployment yet (missing VITE_VAPID_PUBLIC_KEY at build time — set it and restart/rebuild the dev server).",
        );
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "default");
        throw new Error(
          permission === "denied"
            ? "Notification permission was denied."
            : "Notification permission wasn't granted.",
        );
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        }));

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.["p256dh"] || !json.keys?.["auth"]) {
        throw new Error("Could not read the push subscription details.");
      }

      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint,
          p256dh: json.keys["p256dh"],
          auth: json.keys["auth"],
        },
        { onConflict: "endpoint" },
      );
      if (error) throw new Error(error.message);

      setPushState("subscribed");
    } catch (e) {
      const messageText = e instanceof Error ? e.message : "Could not enable push notifications.";
      setPushError(messageText);
      throw e instanceof Error ? e : new Error(messageText);
    }
  }, [user]);

  const disablePush = useCallback(async () => {
    if (!pushSupported()) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        const { error } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", endpoint);
        if (error) console.error("delete push_subscriptions row failed:", error.message);
      }
      setPushState("default");
      setPushError(null);
    } catch (e) {
      console.error("disablePush failed:", e instanceof Error ? e.message : e);
    }
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      pushState,
      pushError,
      enablePush,
      disablePush,
    }),
    [
      notifications,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      pushState,
      pushError,
      enablePush,
      disablePush,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationsProvider>");
  return ctx;
}