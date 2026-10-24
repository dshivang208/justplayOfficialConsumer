/**
 * Referral & points program — client side.
 *
 * Everything here is driven by the admin-controlled `referral_settings` row,
 * exposed publicly through the `get_referral_program()` RPC. The server is the
 * source of truth for every number (rewards, redemption caps); this file only
 * mirrors the maths so the UI can preview what checkout will do.
 */
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "./supabaseClient";
import { useAuth } from "./auth";
import { useWallet } from "./wallet";

export type ReferralProgram = {
  enabled: boolean;
  redemptionEnabled: boolean;
  referrerPoints: number;
  refereePoints: number;
  trigger: "signup" | "first_booking";
  minBookingAmount: number;
  pointValueInr: number;
  maxRedeemPercent: number;
  minRedeemPoints: number;
};

/** Used until the program loads, or when the migration isn't applied yet. */
export const PROGRAM_OFF: ReferralProgram = {
  enabled: false,
  redemptionEnabled: false,
  referrerPoints: 0,
  refereePoints: 0,
  trigger: "first_booking",
  minBookingAmount: 0,
  pointValueInr: 1,
  maxRedeemPercent: 50,
  minRedeemPoints: 0,
};

export function useReferralProgram() {
  const query = useQuery({
    queryKey: ["referral-program"],
    staleTime: 60_000,
    queryFn: async (): Promise<ReferralProgram> => {
      const { data, error } = await supabase.rpc("get_referral_program");
      if (error || !data) return PROGRAM_OFF;
      return { ...PROGRAM_OFF, ...(data as Partial<ReferralProgram>) };
    },
  });
  return { program: query.data ?? PROGRAM_OFF, loading: query.isLoading };
}

export function formatPoints(n: number) {
  return `${n.toLocaleString("en-IN")} pt${Math.abs(n) === 1 ? "" : "s"}`;
}

/** ₹ value of a points amount (rounded down, like the server). */
export function pointsToInr(points: number, program: ReferralProgram) {
  return Math.floor(points * program.pointValueInr);
}

/**
 * Mirror of the server's redemption rules for a booking total (₹):
 * how many points can be spent, and the ₹ discount they give.
 */
export function previewRedemption(total: number, balance: number, program: ReferralProgram) {
  if (!program.redemptionEnabled || total <= 0 || balance <= 0) return { points: 0, inr: 0, max: 0 };
  const capInr = Math.floor((total * program.maxRedeemPercent) / 100);
  const capPts = Math.floor(capInr / program.pointValueInr);
  const max = Math.max(0, Math.min(balance, capPts));
  if (max <= 0 || max < program.minRedeemPoints) return { points: 0, inr: 0, max };
  const inr = Math.min(Math.floor(max * program.pointValueInr), total);
  const points = Math.ceil(inr / program.pointValueInr);
  return { points, inr, max };
}

// ── Referral code capture ────────────────────────────────────────────────────

const STORAGE_KEY = "jp_pending_referral_code";

export function savePendingReferralCode(code: string) {
  try {
    const clean = code.trim().toUpperCase();
    if (clean) localStorage.setItem(STORAGE_KEY, clean);
  } catch {
    /* storage unavailable — the code can still be typed at signup */
  }
}

export function getPendingReferralCode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearPendingReferralCode() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

const ERROR_COPY: Record<string, string> = {
  PROGRAM_DISABLED: "The referral program isn't running right now.",
  INVALID_CODE: "That referral code doesn't exist. Check it and try again.",
  SELF_REFERRAL: "You can't use your own referral code.",
  ALREADY_REFERRED: "You've already used a referral code.",
  NOT_ELIGIBLE: "Referral codes work for new accounts that haven't booked yet.",
};

export function referralErrorMessage(message: string) {
  const key = Object.keys(ERROR_COPY).find((k) => message.includes(k));
  return key ? ERROR_COPY[key]! : "Couldn't apply that code. Please try again.";
}

export type ApplyResult = { rewardedNow: boolean; refereePoints: number; trigger: string };

export async function applyReferralCode(code: string): Promise<ApplyResult> {
  const { data, error } = await supabase.rpc("apply_referral_code", { p_code: code });
  if (error) throw new Error(referralErrorMessage(error.message));
  const r = (data ?? {}) as Partial<ApplyResult>;
  return {
    rewardedNow: Boolean(r.rewardedNow),
    refereePoints: r.refereePoints ?? 0,
    trigger: r.trigger ?? "first_booking",
  };
}

/**
 * Mount once (inside Auth + Wallet providers). When a signed-in player has a
 * code waiting from a shared link (/r/CODE), apply it exactly once.
 */
export function ReferralCapture() {
  const { isAuthenticated, user } = useAuth();
  const { refresh } = useWallet();
  const qc = useQueryClient();
  const tried = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const code = getPendingReferralCode();
    if (!code || tried.current === `${user.id}:${code}`) return;
    tried.current = `${user.id}:${code}`;

    void (async () => {
      try {
        const res = await applyReferralCode(code);
        clearPendingReferralCode();
        void refresh();
        void qc.invalidateQueries({ queryKey: ["referral-program"] });
        toast.success(
          res.rewardedNow
            ? `Referral applied — ${formatPoints(res.refereePoints)} added to your account!`
            : res.refereePoints > 0
              ? `Referral applied — you'll get ${formatPoints(res.refereePoints)} after your first booking.`
              : "Referral code applied.",
        );
      } catch (e) {
        // Terminal outcomes — nothing to retry, so drop the code quietly.
        clearPendingReferralCode();
        const msg = e instanceof Error ? e.message : "";
        if (msg && !msg.includes("already used")) toast.error(msg);
      }
    })();
  }, [isAuthenticated, user, refresh, qc]);

  return null;
}
