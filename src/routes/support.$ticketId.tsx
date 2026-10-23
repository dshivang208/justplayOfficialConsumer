import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Send } from "lucide-react";
import { PageShell } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { JustPlayMark } from "@/components/jp/JustPlayMark";
import { TicketStatusBadge } from "@/components/jp/TicketStatusBadge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import {
  CATEGORY_LABELS,
  fetchTicket,
  resolveMyTicket,
  sendTicketMessage,
  type SupportMessage,
  type SupportTicket,
} from "@/lib/support";

export const Route = createFileRoute("/support/$ticketId")({
  head: () => ({
    meta: [{ title: "Support request | JustPlay" }, { name: "robots", content: "noindex" }],
  }),
  component: TicketPage,
});

function dayLabel(iso: string) {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function TicketPage() {
  const { ticketId } = Route.useParams();
  const { isAuthenticated } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetchTicket(ticketId);
    if (!res) {
      setState("missing");
      return;
    }
    setTicket(res.ticket);
    setMessages(res.messages);
    setState("ready");
  }, [ticketId]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void load();
    const channel = supabase
      .channel(`support-ticket-${ticketId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_ticket_messages", filter: `ticket_id=eq.${ticketId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets", filter: `id=eq.${ticketId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticketId, isAuthenticated, load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const back = (
    <Link
      to="/support"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> All requests
    </Link>
  );

  if (!isAuthenticated) {
    return (
      <PageShell>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">Sign in to view this request.</p>
          <Button asChild className="mt-4">
            <Link to="/auth" search={{ redirect: `/support/${ticketId}` }}>
              Sign in
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  if (state === "loading") {
    return (
      <PageShell>
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      </PageShell>
    );
  }

  if (state === "missing" || !ticket) {
    return (
      <PageShell>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-3xl">Request not found</h1>
          <div className="mt-6 flex justify-center">{back}</div>
        </div>
      </PageShell>
    );
  }

  const closed = ticket.status === "closed";
  const resolved = ticket.status === "resolved";

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    try {
      await sendTicketMessage(ticket.id, text);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send that message.");
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const markSolved = async () => {
    try {
      await resolveMyTicket(ticket.id);
      toast.success("Marked as solved. You can still reply if it comes back.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the ticket.");
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        {back}
        <header className="mt-4 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl leading-tight sm:text-3xl">{ticket.subject}</h1>
            <p className="mt-1.5 text-xs text-muted-foreground">
              #{ticket.ticketNo} · {CATEGORY_LABELS[ticket.category]} · opened{" "}
              {new Date(ticket.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <TicketStatusBadge status={ticket.status} />
        </header>

        {ticket.bookingId ? (
          <p className="mt-3 text-xs">
            <Link to="/bookings" className="font-semibold text-primary hover:underline">
              View your bookings
            </Link>{" "}
            <span className="text-muted-foreground">· this request is linked to one of them</span>
          </p>
        ) : null}

        <div className="mt-5 flex h-[calc(100dvh-20rem)] min-h-[24rem] flex-col overflow-hidden rounded-2xl border border-border bg-background">
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
            {messages.map((m, i) => {
              const mine = m.senderKind === "user";
              const showDay =
                i === 0 || dayLabel(messages[i - 1]!.createdAt) !== dayLabel(m.createdAt);
              return (
                <div key={m.id} className="space-y-3">
                  {showDay ? (
                    <div className="flex justify-center">
                      <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {dayLabel(m.createdAt)}
                      </span>
                    </div>
                  ) : null}
                  <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                    {mine ? null : <JustPlayMark className="h-8 w-8 text-base" />}
                    <div className={`flex max-w-[80%] flex-col ${mine ? "items-end" : "items-start"}`}>
                      {mine ? null : (
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          JustPlay Support
                        </span>
                      )}
                      <div
                        className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                          mine
                            ? "rounded-tr-sm bg-primary text-primary-foreground"
                            : "rounded-tl-sm border border-primary/30 bg-primary/5 text-foreground"
                        }`}
                      >
                        {m.body}
                      </div>
                      <span className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {closed ? (
            <p className="border-t border-border px-3 py-3 text-center text-xs text-muted-foreground">
              This request is closed.{" "}
              <Link to="/support" className="font-semibold text-primary hover:underline">
                Open a new one
              </Link>{" "}
              if you still need help.
            </p>
          ) : (
            <div className="border-t border-border p-2.5">
              {resolved ? (
                <p className="mb-2 px-1 text-xs text-muted-foreground">
                  Marked as resolved. Reply below to reopen it.
                </p>
              ) : null}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  rows={2}
                  maxLength={2000}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Write a reply…"
                  className="min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!draft.trim() || sending}
                  aria-label="Send reply"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {!closed && !resolved ? (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => void markSolved()}>
              <CheckCircle2 className="h-4 w-4" /> Mark as solved
            </Button>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
