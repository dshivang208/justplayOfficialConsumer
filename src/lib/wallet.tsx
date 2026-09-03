/**
 * Backend Phase F: wallet + referrals, backed by real `wallet_transactions`
 * (balance derived via the `my_wallet_balance` RPC — never a stored,
 * client-editable field) and `referrals` (real per-user code from
 * `users.referral_code`, generated server-side at signup — see the
 * `handle_new_auth_user` trigger).
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

export type ReferralStatus = "invited" | "joined" | "completed";

export type Referral = {
  id: string;
  name: string;
  phone: string;
  status: ReferralStatus;
  rewardAmount?: number;
  date: string;
};

export type WalletTransaction = {
  id: string;
  label: string;
  amount: number;
  date: string;
};

type WalletContextValue = {
  balance: number;
  referralCode: string;
  referrals: Referral[];
  transactions: WalletTransaction[];
  loading: boolean;
  /** Re-fetches balance/referrals/transactions — call after anything that
   *  might change them (e.g. right after a booking payment completes). */
  refresh: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return phone;
  return `${digits.slice(0, 2)}••••${digits.slice(8)}`;
}

function transactionLabel(type: string, description: string | null) {
  if (description) return description;
  switch (type) {
    case "referral_reward":
      return "Referral reward";
    case "redeemed":
      return "Applied to a booking";
    case "refund":
      return "Refund";
    default:
      return "Wallet update";
  }
}

const emptyState = { balance: 0, referralCode: "", referrals: [] as Referral[], transactions: [] as WalletTransaction[] };

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState(emptyState);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setState(emptyState);
      return;
    }
    setLoading(true);

    const [balanceRes, referralCodeRes, referralsRes, txRes] = await Promise.all([
      supabase.rpc("my_wallet_balance"),
      supabase.from("users").select("referral_code").eq("id", user.id).maybeSingle(),
      supabase
        .from("referrals")
        .select("id, referred_phone, status, reward_amount, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("wallet_transactions")
        .select("id, amount, type, description, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (balanceRes.error) console.error("my_wallet_balance failed:", balanceRes.error.message);
    if (referralsRes.error) console.error("fetch referrals failed:", referralsRes.error.message);
    if (txRes.error) console.error("fetch wallet_transactions failed:", txRes.error.message);

    const statusMap: Record<string, ReferralStatus> = {
      invited: "invited",
      joined: "joined",
      first_booking_complete: "completed",
    };

    setState({
      balance: (balanceRes.data as number | null) ?? 0,
      referralCode: referralCodeRes.data?.referral_code ?? "",
      referrals: (referralsRes.data ?? []).map((r) => ({
        id: r.id,
        name: "Friend",
        phone: maskPhone(r.referred_phone),
        status: statusMap[r.status] ?? "invited",
        rewardAmount: r.reward_amount || undefined,
        date: r.created_at,
      })),
      transactions: (txRes.data ?? []).map((t) => ({
        id: t.id,
        label: transactionLabel(t.type, t.description),
        amount: t.amount,
        date: t.created_at,
      })),
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<WalletContextValue>(
    () => ({ ...state, loading, refresh: load }),
    [state, loading, load],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

/** Invite a friend by phone number — creates a `referrals` row that links
 *  itself automatically the moment that phone number signs up (see the
 *  `link_referral_on_signup` trigger), and pays out once they complete
 *  their first confirmed booking. Not wired into the current invite UI
 *  (which only shares a code link, no phone capture yet) — exported for
 *  when that flow is added. */
export async function createReferral(phone: string) {
  const { data, error } = await supabase.rpc("create_referral", { p_referred_phone: phone });
  if (error) throw new Error(error.message || "Could not create the referral");
  return data;
}