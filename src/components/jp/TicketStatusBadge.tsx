import { STATUS_LABELS, type TicketStatus } from "@/lib/support";

const TONE: Record<TicketStatus, string> = {
  open: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  waiting_user: "bg-accent/15 text-accent",
  resolved: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${TONE[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
