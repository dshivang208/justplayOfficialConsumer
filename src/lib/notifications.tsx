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
 * Also owns web push via Firebase Cloud Messaging (src/lib/push.ts): asking
 * browser permission, saving this browser's FCM token, and showing pushes
 * that arrive while the app is open. Closed-tab delivery is handled by
 * public/firebase-messaging-sw.js.
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
import { toast } from "sonner";
import { useAuth } from "./auth";
import { supabase } from "./supabaseClient";
import {
  currentPushState,
  disablePush as disablePushCore,
  enablePush as enablePushCore,
  onForegroundPush,
  pushUnsupportedReason,
  refreshPushToken,
} from "./push";

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

  // Reflect what this browser already knows, on load.
  useEffect(() => {
    const st = currentPushState();
    if (st === "unsupported") {
      setPushState("unsupported");
      setPushError(pushUnsupportedReason());
    } else if (st === "unconfigured") {
      setPushState("unsupported");
      setPushError("Push notifications aren't set up on this site yet.");
    } else if (st === "denied") {
      setPushState("denied");
      setPushError("Notifications are blocked for this site in your browser settings.");
    } else {
      setPushState(st === "enabled" ? "subscribed" : "default");
    }
  }, []);

  // Signed in + already allowed: keep this browser's token attached to the account.
  useEffect(() => {
    if (isAuthenticated) void refreshPushToken("consumer");
  }, [isAuthenticated, user?.id]);

  // A push that lands while the app is open: refresh the bell and toast it.
  useEffect(() => {
    if (!isAuthenticated) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    void onForegroundPush((m) => {
      void refresh();
      toast(m.body || m.title);
    }).then((u) => {
      if (cancelled) u();
      else off = u;
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, [isAuthenticated, refresh]);

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
      await enablePushCore("consumer");
      setPushState("subscribed");
    } catch (e) {
      const messageText = e instanceof Error ? e.message : "Could not enable push notifications.";
      setPushError(messageText);
      if (Notification.permission === "denied") setPushState("denied");
      throw e instanceof Error ? e : new Error(messageText);
    }
  }, [user]);

  const disablePush = useCallback(async () => {
    await disablePushCore();
    setPushState("default");
    setPushError(null);
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