/**
 * Real, Supabase-backed saved payment methods — replaces the hardcoded
 * mock array that used to live in src/routes/profile.tsx. UPI is the only
 * type that can actually be added right now; 'card' exists in the schema
 * for later, once a real Razorpay-vaulted-token "add card" flow is wired
 * up (never raw card numbers — see the migration's comments).
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

export type SavedPaymentMethod = {
  id: string;
  type: "upi" | "card";
  maskedIdentifier: string;
  isDefault: boolean;
  createdAt: string;
};

/** UPI VPA format: <handle>@<bank>, e.g. "shivang@okhdfcbank" or
 *  "9876543210@ybl". Matches the pattern real UPI apps accept. */
export function isValidUpiId(value: string): boolean {
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(value.trim());
}

type PaymentMethodsContextValue = {
  methods: SavedPaymentMethod[];
  loading: boolean;
  addUpiMethod: (upiId: string, setDefault?: boolean) => Promise<SavedPaymentMethod>;
  setDefaultMethod: (id: string) => Promise<void>;
  removeMethod: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const PaymentMethodsContext = createContext<PaymentMethodsContextValue | null>(null);

type SavedPaymentMethodRow = {
  id: string;
  type: "upi" | "card";
  masked_identifier: string;
  is_default: boolean;
  created_at: string;
};

function mapRow(row: SavedPaymentMethodRow): SavedPaymentMethod {
  return {
    id: row.id,
    type: row.type,
    maskedIdentifier: row.masked_identifier,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

export function PaymentMethodsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setMethods([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("saved_payment_methods")
      .select("id, type, masked_identifier, is_default, created_at")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) console.error("fetch saved_payment_methods failed:", error.message);
    setMethods((data ?? []).map(mapRow));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const addUpiMethod = useCallback(
    async (upiId: string, setDefault = false) => {
      const trimmed = upiId.trim();
      if (!isValidUpiId(trimmed)) {
        throw new Error("That UPI ID doesn't look right. Use the format name@bank.");
      }
      const { data, error } = await supabase.rpc("add_payment_method", {
        p_type: "upi",
        p_masked_identifier: trimmed,
        p_set_default: setDefault,
      });
      if (error) throw new Error(error.message);
      await load();
      return mapRow(data);
    },
    [load],
  );

  const setDefaultMethod = useCallback(
    async (id: string) => {
      const { error } = await supabase.rpc("set_default_payment_method", { p_method_id: id });
      if (error) throw new Error(error.message);
      await load();
    },
    [load],
  );

  const removeMethod = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("saved_payment_methods").delete().eq("id", id);
      if (error) throw new Error(error.message);
      await load();
    },
    [load],
  );

  const value = useMemo<PaymentMethodsContextValue>(
    () => ({ methods, loading, addUpiMethod, setDefaultMethod, removeMethod, refresh: load }),
    [methods, loading, addUpiMethod, setDefaultMethod, removeMethod, load],
  );

  return <PaymentMethodsContext.Provider value={value}>{children}</PaymentMethodsContext.Provider>;
}

export function usePaymentMethods() {
  const ctx = useContext(PaymentMethodsContext);
  if (!ctx) throw new Error("usePaymentMethods must be used inside <PaymentMethodsProvider>");
  return ctx;
}