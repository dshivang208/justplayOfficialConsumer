import { Check, Smartphone, CreditCard, Landmark, ChevronDown, Gift } from "lucide-react";
import type { Slot, VenueDetail } from "@/data/venues";
import { formatDateLong, formatINR, upcomingDays, type PriceBreakdown } from "@/lib/booking";
import { cn } from "@/lib/utils";

export const stepTitles = ["Sport & date", "Time slot", "Summary", "Payment", "Confirmed"];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="no-scrollbar flex items-center gap-2 overflow-x-auto">
      {stepTitles.map((title, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={title} className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                done && "bg-primary text-primary-foreground",
                active && "border-2 border-primary bg-primary/10 text-primary",
                !done && !active && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-xs font-semibold",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {title}
            </span>
            {i < stepTitles.length - 1 ? <span className="h-px w-5 bg-border sm:w-8" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function SportDateStep({
  venue,
  sport,
  onSportChange,
  date,
  onDateChange,
}: {
  venue: VenueDetail;
  sport: string;
  onSportChange: (s: string) => void;
  date: string;
  onDateChange: (d: string) => void;
}) {
  const days = upcomingDays(14);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl leading-none">Which sport?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {venue.sports.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSportChange(s)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                sport === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-primary hover:text-primary",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl leading-none">Pick a date</h2>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => onDateChange(d.iso)}
              className={cn(
                "flex w-16 shrink-0 flex-col items-center rounded-xl border py-2.5 transition-colors",
                date === d.iso
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface hover:border-primary",
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                {d.isToday ? "Today" : d.weekday}
              </span>
              <span className="font-display text-xl leading-tight">{d.day}</span>
              <span className="text-[10px] font-semibold opacity-80">{d.month}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {venue.openingHours} · slots are shown per hour
        </p>
      </div>
    </div>
  );
}

export function SummaryStep({
  venue,
  sport,
  date,
  slots,
  breakdown,
  creditApplied = 0,
}: {
  venue: VenueDetail;
  sport: string;
  date: string;
  slots: Slot[];
  breakdown: PriceBreakdown;
  creditApplied?: number;
}) {
  const rows: Array<[string, string]> = [
    ["Venue", venue.name],
    ["Area", `${venue.area}, Kanpur`],
    ["Sport", sport],
    ["Date", formatDateLong(date)],
    ["Slots", slots.map((s) => s.label).join(", ")],
  ];
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-2xl leading-none">Booking summary</h2>
      <div className="surface-card overflow-hidden rounded-2xl">
        <img src={venue.image} alt={venue.name} className="h-32 w-full object-cover" />
        <dl className="divide-y divide-border">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4 px-4 py-2.5">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {k}
              </dt>
              <dd className="text-right text-sm font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <PriceCard breakdown={breakdown} creditApplied={creditApplied} />
    </div>
  );
}

export function PriceCard({
  breakdown,
  creditApplied = 0,
}: {
  breakdown: PriceBreakdown;
  creditApplied?: number;
}) {
  const payable = Math.max(0, breakdown.total - creditApplied);
  return (
    <div className="surface-card rounded-2xl p-4">
      <h3 className="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Price breakdown
      </h3>
      <div className="flex flex-col gap-2 text-sm">
        <Row
          label={`Slot charges (${breakdown.slotCount} hr)`}
          value={formatINR(breakdown.basePrice)}
        />
        <Row label="Platform fee (5%)" value={formatINR(breakdown.platformFee)} />
        <Row label="GST (18%)" value={formatINR(breakdown.gst)} />
        {creditApplied > 0 ? (
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
              <Gift className="h-3.5 w-3.5" /> Reward credit applied
            </span>
            <span className="font-semibold text-primary">-{formatINR(creditApplied)}</span>
          </div>
        ) : null}
        <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm font-bold">Total payable</span>
          <span className="font-display text-2xl leading-none text-primary">
            {formatINR(payable)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export type PaymentMethod = "upi" | "card" | "netbanking";

const upiApps = ["Google Pay", "PhonePe", "Paytm", "BHIM"];

export function PaymentStep({
  method,
  onMethodChange,
  breakdown,
  upiId,
  onUpiIdChange,
  error,
  creditApplied = 0,
  availableCredit = 0,
}: {
  method: PaymentMethod;
  onMethodChange: (m: PaymentMethod) => void;
  breakdown: PriceBreakdown;
  upiId: string;
  onUpiIdChange: (v: string) => void;
  error?: string | null;
  creditApplied?: number;
  availableCredit?: number;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-2xl leading-none">Payment</h2>

      {availableCredit > 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Gift className="h-4.5 w-4.5" />
          </span>
          <p className="text-sm font-semibold text-foreground">
            {creditApplied > 0
              ? `Reward credit applied: -${formatINR(creditApplied)}`
              : `You have ${formatINR(availableCredit)} reward credit`}
          </p>
        </div>
      ) : null}

      <div
        className={cn(
          "rounded-2xl border-2 p-4 transition-colors",
          method === "upi" ? "border-primary bg-primary/5" : "border-border bg-surface",
        )}
      >
        <button
          type="button"
          onClick={() => onMethodChange("upi")}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-bold">UPI</span>
            <span className="block text-xs text-muted-foreground">
              Fastest — pay from any UPI app
            </span>
          </span>
          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
            Recommended
          </span>
        </button>

        {method === "upi" ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {upiApps.map((app) => (
                <span
                  key={app}
                  className="rounded-xl border border-border bg-surface px-2 py-2.5 text-center text-xs font-semibold"
                >
                  {app}
                </span>
              ))}
            </div>
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Or enter UPI ID
              </span>
              <input
                value={upiId}
                onChange={(e) => onUpiIdChange(e.target.value)}
                placeholder="yourname@upi"
                className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
        ) : null}
      </div>

      <CollapsedMethod
        icon={<CreditCard className="h-5 w-5" />}
        title="Credit / Debit card"
        subtitle="Visa, Mastercard, RuPay"
        active={method === "card"}
        onClick={() => onMethodChange("card")}
      >
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            placeholder="Card number"
            className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary sm:col-span-2"
          />
          <input
            placeholder="MM / YY"
            className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            placeholder="CVV"
            className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
        </div>
      </CollapsedMethod>

      <CollapsedMethod
        icon={<Landmark className="h-5 w-5" />}
        title="Netbanking"
        subtitle="All major Indian banks"
        active={method === "netbanking"}
        onClick={() => onMethodChange("netbanking")}
      >
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["HDFC", "ICICI", "SBI", "Axis"].map((b) => (
            <span
              key={b}
              className="rounded-xl border border-border bg-surface px-2 py-2.5 text-center text-xs font-semibold"
            >
              {b}
            </span>
          ))}
        </div>
      </CollapsedMethod>

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm font-semibold text-destructive">
          {error}
        </p>
      ) : null}

      <PriceCard breakdown={breakdown} creditApplied={creditApplied} />
    </div>
  );
}

function CollapsedMethod({
  icon,
  title,
  subtitle,
  active,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        active ? "border-primary bg-primary/5" : "border-border bg-surface",
      )}
    >
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </span>
        <span className="flex-1">
          <span className="block text-sm font-bold">{title}</span>
          <span className="block text-xs text-muted-foreground">{subtitle}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            active && "rotate-180",
          )}
        />
      </button>
      {active ? children : null}
    </div>
  );
}