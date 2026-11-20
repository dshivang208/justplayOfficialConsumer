import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

const REASONS = [
  { id: "spam", label: "Spam" },
  { id: "abuse", label: "Abusive language" },
  { id: "harassment", label: "Harassment" },
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "other", label: "Something else" },
] as const;

/** Small "report" flag for another player's message. Sends it to the admin moderation queue. */
export function ReportButton({
  kind,
  contentId,
  className = "",
}: {
  kind: "group_message" | "game_question" | "venue_group_message";
  contentId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (reason: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("report_content", {
      p_kind: kind,
      p_content_id: contentId,
      p_reason: reason,
      p_details: null,
    });
    setBusy(false);
    setOpen(false);
    if (error) toast.error("Couldn't send your report. Please try again.");
    else toast.success("Thanks — our team will review this message.");
  };

  return (
    <span className={`inline-block ${className}`}>
      <button
        type="button"
        aria-label="Report message"
        title="Report"
        onClick={() => setOpen((o) => !o)}
        className="text-muted-foreground/70 hover:text-destructive"
      >
        <Flag className="h-3 w-3" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[300] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Report this message">
              <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 cursor-default bg-black/50"
                onClick={() => setOpen(false)}
              />
              <div className="relative w-full rounded-t-2xl border border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl sm:w-80 sm:rounded-2xl">
                <div className="mb-1 flex items-center justify-between px-1">
                  <p className="text-sm font-bold text-foreground">Report this message</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
                <p className="mb-2 px-1 text-xs text-muted-foreground">Why are you reporting it?</p>
                {REASONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void send(r.id)}
                    className="block w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-foreground hover:bg-secondary active:bg-secondary"
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
