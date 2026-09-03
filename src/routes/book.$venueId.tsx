import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CalendarPlus, CheckCircle2, Loader2, Ticket } from "lucide-react";
import { Navbar } from "@/components/jp/Navbar";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";
import { Button } from "@/components/jp/Button";
import { SlotGrid, SlotLegend } from "@/components/jp/booking/SlotGrid";
import {
  PaymentStep,
  SportDateStep,
  Stepper,
  SummaryStep,
  type PaymentMethod,
} from "@/components/jp/booking/steps";
import { fetchSlots, fetchVenue, formatHour, type Slot } from "@/data/venues";
import {
  calculatePrice,
  displayBookingId,
  formatDateLong,
  formatINR,
  isContiguous,
  slotRangeLabel,
  upcomingDays,
} from "@/lib/booking";
import { payForBooking } from "@/lib/razorpay";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/book/$venueId")({
  loader: async ({ params }) => {
    const venue = await fetchVenue(params.venueId);
    if (!venue) throw notFound();
    return { venue };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Booking unavailable | JustPlay" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `Book ${loaderData.venue.name} — Slots & Payment | JustPlay`;
    const description = `Pick a sport, date and time slot at ${loaderData.venue.name}, ${loaderData.venue.area}, Kanpur. UPI checkout, instant confirmation.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-4xl">Venue not found</h1>
        <Button asChild className="mt-6">
          <Link to="/venues">Browse venues</Link>
        </Button>
      </div>
    </div>
  ),
  component: BookingFlow,
});

function BookingFlow() {
  const { venue } = Route.useLoaderData();
  const days = upcomingDays(14);
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { balance, refresh: refreshWallet } = useWallet();

  const [step, setStep] = useState(0);
  const [sport, setSport] = useState(venue.sports[0] ?? "Cricket");
  const [date, setDate] = useState(days[0]!.iso);
  const [selected, setSelected] = useState<Slot[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [upiId, setUpiId] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setSlotsLoading(true);
    fetchSlots(venue.id, date, sport).then((next) => {
      if (!active) return;
      setSlots(next);
      setSlotsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [venue.id, date, sport]);

  const breakdown = useMemo(() => calculatePrice(selected), [selected]);
  const creditApplied = Math.max(0, Math.min(balance, breakdown.total));
  const payableTotal = Math.max(0, breakdown.total - creditApplied);
  const sortedSelected = useMemo(
    () => [...selected].sort((a, b) => a.startHour - b.startHour),
    [selected],
  );

  const resetSlots = (fn: () => void) => {
    setSelected([]);
    fn();
  };

  const toggleSlot = (slot: Slot) => {
    setError(null);
    setSelected((prev) => {
      const exists = prev.some((s) => s.id === slot.id);
      const next = exists ? prev.filter((s) => s.id !== slot.id) : [...prev, slot];
      if (!exists && next.length > 1 && !isContiguous(next)) return [slot];
      return next;
    });
  };

  const canContinue = step === 0 ? Boolean(sport && date) : step === 1 ? selected.length > 0 : true;

  const handleNext = () => {
    if (step === 3) {
      void handlePay();
      return;
    }
    if (!canContinue) return;
    if (step === 1 && !isAuthenticated) {
      navigate({
        to: "/auth",
        search: { redirect: `/book/${venue.id}` },
      });
      return;
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  const handlePay = async () => {
    if (method === "upi" && upiId && !upiId.includes("@")) {
      setError("That UPI ID doesn't look right. Use the format name@bank.");
      return;
    }
    setError(null);
    setPaying(true);

    let createdBookingId: string | null = null;
    try {
      // Step 1 (Phase C): atomically lock the selected slot(s) + insert one
      // 'pending' booking. A Postgres-level row lock means a second person
      // clicking "Pay" on the same slot at the same instant gets
      // SLOT_UNAVAILABLE here instead of a double booking.
      const { data: booking, error: rpcError } = await supabase.rpc("create_booking", {
        p_slot_ids: sortedSelected.map((s) => s.id),
        p_credit_applied: creditApplied,
      });
      if (rpcError) throw new Error(rpcError.message);
      createdBookingId = booking.id as string;

      // Step 2 (Phase D): Razorpay Checkout, verified server-side — the
      // booking only flips to 'confirmed' once the Edge Function checks the
      // payment signature (or the webhook backup fires), never on the
      // frontend's say-so alone.
      const result = await payForBooking({
        bookingId: createdBookingId,
        ...(user?.name ? { userName: user.name } : {}),
        ...(user?.phone ? { userPhone: user.phone } : {}),
        ...(user?.email ? { userEmail: user.email } : {}),
      });

      if (result.status === "cancelled") {
        // User closed the Razorpay modal without paying — release the slot
        // rather than leave it locked in limbo.
        await supabase.rpc("release_failed_booking", { p_booking_id: createdBookingId });
        setError("Payment was cancelled. Your slot has been released — you can try again.");
        setPaying(false);
        return;
      }

      void refreshWallet();
      setPaying(false);
      setBookingId(displayBookingId(createdBookingId));
      setStep(4);
    } catch (e) {
      if (createdBookingId) {
        try {
          await supabase.rpc("release_failed_booking", { p_booking_id: createdBookingId });
        } catch {
          /* best-effort release — the RPC's own state check makes a retry harmless */
        }
      }
      setError(
        e instanceof Error && e.message.includes("SLOT_UNAVAILABLE")
          ? "Someone just booked one of these slots. Please pick another time."
          : e instanceof Error
            ? e.message
            : "Payment failed. Please try again.",
      );
      setPaying(false);
    }
  };

  const timeLabel = slotRangeLabel(sortedSelected, formatHour);

  const calendarHref = useMemo(() => {
    if (sortedSelected.length === 0) return "#";
    const pad = (n: number) => String(n).padStart(2, "0");
    const d = date.replace(/-/g, "");
    const start = `${d}T${pad(sortedSelected[0]!.startHour)}0000`;
    const end = `${d}T${pad(sortedSelected[sortedSelected.length - 1]!.startHour + 1)}0000`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `SUMMARY:${sport} at ${venue.name}`,
      `LOCATION:${venue.address}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `DESCRIPTION:JustPlay booking ${bookingId}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  }, [sortedSelected, date, sport, venue, bookingId]);

  return (
    <div className="flex min-h-screen flex-col pb-28 lg:pb-0">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
        {step < 4 ? (
          <>
            <Link
              to="/venues/$venueId"
              params={{ venueId: venue.id }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {venue.name}
            </Link>
            <div className="mt-4">
              <Stepper current={step} />
            </div>
          </>
        ) : null}

        <div className="mt-6">
          {step === 0 ? (
            <SportDateStep
              venue={venue}
              sport={sport}
              onSportChange={(s) => resetSlots(() => setSport(s))}
              date={date}
              onDateChange={(d) => resetSlots(() => setDate(d))}
            />
          ) : null}

          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-2xl leading-none">Pick your slot</h2>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {sport} · {formatDateLong(date)} · select one or more back-to-back hours
                </p>
              </div>
              <SlotLegend />
              {slotsLoading ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {Array.from({ length: 15 }).map((_, i) => (
                    <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : (
                <SlotGrid
                  slots={slots}
                  selectedIds={selected.map((s) => s.id)}
                  onToggle={toggleSlot}
                />
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <SummaryStep
              venue={venue}
              sport={sport}
              date={date}
              slots={sortedSelected}
              breakdown={breakdown}
              creditApplied={creditApplied}
            />
          ) : null}

          {step === 3 ? (
            <PaymentStep
              method={method}
              onMethodChange={setMethod}
              breakdown={breakdown}
              upiId={upiId}
              onUpiIdChange={setUpiId}
              error={error}
              creditApplied={creditApplied}
              availableCredit={balance}
            />
          ) : null}

          {step === 4 ? (
            <div className="mx-auto max-w-md py-6 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-9 w-9" />
              </span>
              <h1 className="mt-4 text-4xl leading-none">Slot confirmed!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {user?.name ?? "Player"}, your game is locked. We've sent details to{" "}
                {user?.phone ?? "your phone"}.
              </p>

              <div className="surface-card mt-6 rounded-2xl p-4 text-left">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Ticket className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Booking ID
                  </span>
                  <span className="ml-auto font-display text-xl leading-none">{bookingId}</span>
                </div>
                <dl className="mt-3 flex flex-col gap-2 text-sm">
                  {(
                    [
                      ["Venue", venue.name],
                      ["Address", venue.address],
                      ["Sport", sport],
                      ["Date", formatDateLong(date)],
                      ["Time", timeLabel],
                      ...(creditApplied > 0
                        ? ([["Reward credit used", `-${formatINR(creditApplied)}`]] as Array<
                            [string, string]
                          >)
                        : []),
                      ["Paid", formatINR(payableTotal)],
                    ] as Array<[string, string]>
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-start justify-between gap-4">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="text-right font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline" className="flex-1">
                  <a href={calendarHref} download={`justplay-${bookingId}.ics`}>
                    <CalendarPlus className="h-4 w-4" /> Add to Calendar
                  </a>
                </Button>
                <Button asChild className="flex-1">
                  <Link to="/bookings">View Booking</Link>
                </Button>
              </div>

              <Link
                to="/venues"
                className="mt-4 inline-block text-xs font-semibold text-muted-foreground hover:text-primary"
              >
                Book another venue
              </Link>
            </div>
          ) : null}
        </div>
      </main>

      {step < 4 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <div className="min-w-0">
              {selected.length > 0 ? (
                <>
                  <p className="truncate text-sm font-bold leading-none">
                    {formatINR(payableTotal)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {timeLabel} · {breakdown.slotCount} hr
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  From {formatINR(venue.pricePerHour)} / hour
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step > 0 ? (
                <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              ) : null}
              <Button onClick={handleNext} disabled={!canContinue || paying}>
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Paying…
                  </>
                ) : step === 3 ? (
                  <>Pay {formatINR(payableTotal)}</>
                ) : (
                  <>
                    Continue <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}