import { useState } from "react";
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
  kind: "group_message" | "game_question";
  contentId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

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
    <span className={`relative inline-block ${className}`}>
      <button
        type="button"
        aria-label="Report message"
        title="Report"
        onClick={() => setOpen((o) => !o)}
        className="text-muted-foreground/70 hover:text-destructive"
      >
        <Flag className="h-3 w-3" />
      </button>
      {open ? (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-50 mb-1 w-44 rounded-xl border border-border bg-background p-1 shadow-xl">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Report this message</p>
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                disabled={busy}
                onClick={() => void send(r.id)}
                className="block w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-foreground hover:bg-secondary"
              >
                {r.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </span>
  );
}
