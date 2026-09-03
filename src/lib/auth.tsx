/**
 * App-level auth state for JustPlay (Backend Phase B).
 *
 * Real Supabase Auth session + real `public.users` row — but OTP delivery
 * itself is still mocked (no SMS provider wired up yet). The exported
 * shape of this module (types, `useAuth()` fields, function signatures) is
 * UNCHANGED from the Phase 3 mock so `routes/auth.tsx` and every other
 * screen keep working without edits.
 *
 * SWAP POINT FOR REAL SMS: everything about *how a session gets minted*
 * (the Edge Function `mock-otp-verify`, the magic-link bridge) is isolated
 * behind `verifyOtp` below. When a real SMS provider is wired up, only that
 * Edge Function's OTP-validation step changes — this file, the RLS
 * policies, and every downstream screen stay as-is.
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
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type JPUser = {
  id: string;
  name: string;
  phone: string;
  email?: string | undefined;
  avatar?: string | undefined;
  createdAt: string;
};

export type NotificationPrefs = {
  bookingReminders: boolean;
  offers: boolean;
  gameInvites: boolean;
};

const PREFS_STORAGE_KEY = "justplay.auth.prefs.v1";

/** Any 6-digit code works; this one is shown as the demo hint in the UI. */
export const DEMO_OTP = "123456";

type UsersRow = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  profile_photo_url: string | null;
  created_at: string;
};

type AuthContextValue = {
  user: JPUser | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  prefs: NotificationPrefs;
  setPrefs: (p: Partial<NotificationPrefs>) => void;
  requestOtp: (phone: string) => Promise<void>;
  /** Returns whether the phone belongs to an existing account. */
  verifyOtp: (phone: string, code: string) => Promise<{ isNewUser: boolean }>;
  completeOnboarding: (data: { name: string; email?: string }) => void;
  updateProfile: (data: Partial<Pick<JPUser, "name" | "email" | "avatar">>) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const defaultPrefs: NotificationPrefs = {
  bookingReminders: true,
  offers: false,
  gameInvites: true,
};

export function normalizePhone(input: string) {
  return input.replace(/\D/g, "").slice(-10);
}

export function formatPhone(digits: string) {
  const d = normalizePhone(digits);
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : `+91 ${d}`;
}

function toE164(digits10: string) {
  return `+91${digits10}`;
}

function rowToUser(row: UsersRow): JPUser {
  return {
    id: row.id,
    phone: formatPhone(row.phone),
    name: row.name ?? "",
    email: row.email ?? undefined,
    avatar: row.profile_photo_url ?? undefined,
    createdAt: row.created_at,
  };
}

async function fetchProfileRow(userId: string): Promise<UsersRow | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, phone, name, email, profile_photo_url, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load profile:", error.message);
    return null;
  }
  return data as UsersRow | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<JPUser | null>(null);
  const [prefs, setPrefsState] = useState<NotificationPrefs>(defaultPrefs);
  const [hydrated, setHydrated] = useState(false);

  // Load notification prefs (client-only for now — no backend table for
  // these yet, unrelated to auth/session).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) setPrefsState({ ...defaultPrefs, ...(JSON.parse(raw) as NotificationPrefs) });
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const persistPrefs = useCallback((next: NotificationPrefs) => {
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Real session bootstrap: restore on refresh, then stay in sync with any
  // auth state change (login/logout/token refresh, including other tabs).
  useEffect(() => {
    let active = true;

    void (async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();
      if (!active) return;
      if (initialSession) {
        const row = await fetchProfileRow(initialSession.user.id);
        if (!active) return;
        setSession(initialSession);
        setProfile(row ? rowToUser(row) : null);
      }
      setHydrated(true);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        void fetchProfileRow(newSession.user.id).then((row) => {
          if (active) setProfile(row ? rowToUser(row) : null);
        });
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  /** SWAP POINT (send step): no-op today since there's no SMS provider yet. */
  const requestOtp = useCallback(async (_phone: string) => {
    await new Promise((r) => setTimeout(r, 700));
  }, []);

  /** SWAP POINT (verify step): mock-checks the code, then mints a REAL session. */
  const verifyOtp = useCallback(async (phone: string, code: string) => {
    if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code we sent you.");

    const digits = normalizePhone(phone);
    if (digits.length !== 10) throw new Error("Enter a valid 10-digit Indian mobile number.");

    const { data: fnData, error: fnError } = await supabase.functions.invoke<{
      tokenHash: string;
      isNewUser: boolean;
      profile: UsersRow;
    }>("mock-otp-verify", {
      body: { phone: digits, otp: code },
    });

    if (fnError) throw new Error(fnError.message || "Verification failed. Try again.");
    if (!fnData) throw new Error("Verification failed. Try again.");

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: fnData.tokenHash,
      type: "magiclink",
    });
    if (verifyError || !verifyData.session) {
      throw new Error(verifyError?.message ?? "Could not start session. Try again.");
    }

    setSession(verifyData.session);
    setProfile(rowToUser(fnData.profile));

    return { isNewUser: fnData.isNewUser };
  }, []);

  const completeOnboarding = useCallback(
    (data: { name: string; email?: string }) => {
      if (!session) return;
      const name = data.name.trim();
      const email = data.email?.trim() || undefined;

      // Optimistic local update — keeps the existing synchronous call-site
      // in routes/auth.tsx working unchanged.
      setProfile((prev) => (prev ? { ...prev, name, email } : prev));

      void supabase
        .from("users")
        .update({ name, email: email ?? null })
        .eq("id", session.user.id)
        .then(({ error }) => {
          if (error) console.error("completeOnboarding failed to persist:", error.message);
        });
    },
    [session],
  );

  const updateProfile = useCallback(
    (data: Partial<Pick<JPUser, "name" | "email" | "avatar">>) => {
      if (!session) return;
      setProfile((prev) => (prev ? { ...prev, ...data } : prev));

      const patch: Record<string, string | null> = {};
      if (data.name !== undefined) patch["name"] = data.name;
      if (data.email !== undefined) patch["email"] = data.email || null;
      if (data.avatar !== undefined) patch["profile_photo_url"] = data.avatar || null;
      if (Object.keys(patch).length === 0) return;

      void supabase
        .from("users")
        .update(patch)
        .eq("id", session.user.id)
        .then(({ error }) => {
          if (error) console.error("updateProfile failed to persist:", error.message);
        });
    },
    [session],
  );

  const setPrefs = useCallback(
    (p: Partial<NotificationPrefs>) => {
      setPrefsState((prev) => {
        const next = { ...prev, ...p };
        persistPrefs(next);
        return next;
      });
    },
    [persistPrefs],
  );

  const logout = useCallback(() => {
    // Optimistic clear so protected-route redirects happen instantly, same
    // as the old synchronous mock — the real Supabase session (and its
    // localStorage entry) is revoked right behind it.
    setSession(null);
    setProfile(null);
    void supabase.auth.signOut().catch((e) => console.error("signOut failed:", e));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: profile,
      isAuthenticated: Boolean(session),
      hydrated,
      prefs,
      setPrefs,
      requestOtp,
      verifyOtp,
      completeOnboarding,
      updateProfile,
      logout,
    }),
    [
      profile,
      session,
      hydrated,
      prefs,
      setPrefs,
      requestOtp,
      verifyOtp,
      completeOnboarding,
      updateProfile,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// Exported for the (currently unused, kept for parity with the old module's
// surface) case something needs to build an E.164 number from raw digits.
export { toE164 };