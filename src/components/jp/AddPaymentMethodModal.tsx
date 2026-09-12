import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Smartphone, X } from "lucide-react";
import { isValidUpiId, usePaymentMethods } from "@/lib/paymentMethods";
import { Button } from "./Button";

export function AddPaymentMethodModal({ onClose }: { onClose: () => void }) {
  const { addUpiMethod } = usePaymentMethods();
  const [upiId, setUpiId] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const upiError =
    upiId.trim().length === 0
      ? "Enter a UPI ID."
      : !isValidUpiId(upiId)
        ? "That doesn't look like a valid UPI ID. Use the format name@bank."
        : null;

  const submit = async () => {
    setAttemptedSubmit(true);
    if (upiError) return;
    setSubmitting(true);
    try {
      await addUpiMethod(upiId, setAsDefault);
      toast.success("UPI ID saved");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save this payment method.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl border border-border bg-background p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl leading-none">Add payment method</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border-2 border-primary bg-primary/5 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">UPI ID</p>
              <p className="text-xs text-muted-foreground">Fastest — pay from any UPI app</p>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="upi-add" className="text-xs font-semibold text-muted-foreground">
              UPI ID
            </label>
            <input
              id="upi-add"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@okhdfcbank"
              autoFocus
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary"
            />
            {attemptedSubmit && upiError ? (
              <p className="mt-1 text-xs font-semibold text-destructive">{upiError}</p>
            ) : null}
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={setAsDefault}
              onChange={(e) => setSetAsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Set as default
          </label>
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 opacity-60">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <CreditCard className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold">Credit / Debit card</p>
              <p className="text-xs text-muted-foreground">Visa, Mastercard, RuPay</p>
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Coming soon
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Saved cards will be added once secure card tokenization is wired up — we never store raw
            card numbers.
          </p>
        </div>

        <Button size="lg" className="mt-5 w-full" disabled={submitting} onClick={submit}>
          {submitting ? "Saving…" : "Save UPI ID"}
        </Button>
      </div>
    </div>
  );
}