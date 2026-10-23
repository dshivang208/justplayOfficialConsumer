import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Headset, LifeBuoy, MessageSquare, Plus } from "lucide-react";
import { PageShell, PageHeader } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { EmptyState } from "@/components/jp/states";
import { TicketStatusBadge } from "@/components/jp/TicketStatusBadge";
import { useAuth } from "@/lib/auth";
import { fetchMyBookings, timeRangeLabel, type Booking } from "@/data/bookings";
import {
  CATEGORY_LABELS,
  createTicket,
  fetchMyTickets,
  type SupportTicket,
  type TicketCategory,
} from "@/lib/support";

type Search = { booking?: string };

export const Route = createFileRoute("/support/")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search["booking"] === "string" ? { booking: search["booking"] } : {},
  head: () => ({
    meta: [
      { title: "Help & Support | JustPlay" },
      { name: "description", content: "Raise a support request and track replies from the JustPlay team." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupportPage,
});

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function SupportPage() {
  const { booking: bookingFromUrl } = Route.useSearch();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [formOpen, setFormOpen] = useState(Boolean(bookingFromUrl));
  const [category, setCategory] = useState<TicketCategory>(bookingFromUrl ? "booking" : "other");
  const [bookingId, setBookingId] = useState(bookingFromUrl ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    setTickets(await fetchMyTickets());
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setTickets([]);
      return;
    }
    void load();
    void fetchMyBookings().then((b) => setBookings(b.slice(0, 25)));
  }, [isAuthenticated, userId, load]);

  const submit = async () => {
    if (subject.trim().length < 3) {
      toast.error("Add a short subject.");
      return;
    }
    if (message.trim().length < 10) {
      toast.error("Please describe the problem in a bit more detail.");
      return;
    }
    setSending(true);
    try {
      const t = await createTicket({
        subject: subject.trim(),
        category,
        message: message.trim(),
        bookingId: bookingId || null,
      });
      toast.success(`Ticket #${t.ticketNo} created — we'll reply here.`);
      void navigate({ to: "/support/$ticketId", params: { ticketId: t.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create the ticket.");
    } finally {
      setSending(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="We're here to help"
          title="Help & Support"
          subtitle="Sign in to raise a request and follow the team's replies."
        />
        <div className="mx-auto max-w-xl px-4 py-12 text-center">
          <Button asChild size="lg">
            <Link to="/auth" search={{ redirect: "/support" }}>
              Sign in
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="We're here to help"
        title="Help & Support"
        subtitle="Raise a request and follow the JustPlay team's replies right here."
        action={
          <Button size="lg" onClick={() => setFormOpen((o) => !o)}>
            <Plus className="h-4 w-4" /> New request
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        {formOpen ? (
          <section className="surface-card mb-8 rounded-2xl p-5 sm:p-6">
            <h2 className="text-2xl leading-none">What do you need help with?</h2>
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="t-cat" className="text-xs font-semibold text-muted-foreground">
                  Topic
                </label>
                <select
                  id="t-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary"
                >
                  {(Object.keys(CATEGORY_LABELS) as TicketCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {CATEGORY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              {bookings.length > 0 && (category === "booking" || category === "payment_refund") ? (
                <div>
                  <label htmlFor="t-booking" className="text-xs font-semibold text-muted-foreground">
                    Which booking? (optional)
                  </label>
                  <select
                    id="t-booking"
                    value={bookingId}
                    onChange={(e) => setBookingId(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary"
                  >
                    <option value="">Not about one booking</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.venueName} · {b.sport} · {b.date} · {timeRangeLabel(b)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label htmlFor="t-subject" className="text-xs font-semibold text-muted-foreground">
                  Subject
                </label>
                <input
                  id="t-subject"
                  value={subject}
                  maxLength={120}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Refund not received for cancelled booking"
                  className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-primary"
                />
              </div>

              <div>
                <label htmlFor="t-msg" className="text-xs font-semibold text-muted-foreground">
                  Tell us what happened
                </label>
                <textarea
                  id="t-msg"
                  value={message}
                  rows={5}
                  maxLength={2000}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="The more detail you share, the faster we can sort it out."
                  className="mt-1.5 w-full resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {message.length}/2000
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={sending}>
                  Cancel
                </Button>
                <Button onClick={() => void submit()} disabled={sending}>
                  {sending ? "Sending…" : "Submit request"}
                </Button>
              </div>
            </div>
          </section>
        ) : null}

        <h2 className="text-2xl leading-none">Your requests</h2>
        <div className="mt-4">
          {tickets === null ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={<LifeBuoy className="h-8 w-8" />}
              title="No requests yet"
              description="If something goes wrong with a booking, payment or venue, raise a request and we'll help."
              action={<Button onClick={() => setFormOpen(true)}>New request</Button>}
            />
          ) : (
            <ul className="space-y-3">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    to="/support/$ticketId"
                    params={{ ticketId: t.id }}
                    className="surface-card flex items-center gap-3 rounded-2xl p-4 transition-colors hover:border-primary/60"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {t.lastSenderKind === "admin" && t.status !== "resolved" && t.status !== "closed" ? (
                        <Headset className="h-5 w-5" />
                      ) : (
                        <MessageSquare className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{t.subject}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        #{t.ticketNo} · {CATEGORY_LABELS[t.category]} · {timeAgo(t.lastMessageAt)}
                      </p>
                    </div>
                    <TicketStatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
}
