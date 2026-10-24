import { Link } from "@tanstack/react-router";
import { Check, Smartphone, CreditCard, Landmark, ChevronDown, Gift } from "lucide-react";
import type { Slot, VenueDetail } from "@/data/venues";
import {
  formatDateLong,
  formatDuration,
  formatINR,
  upcomingDays,
  type PriceBreakdown,
} from "@/lib/booking";
import { cn } from "@/lib/utils";

export const stepTitles = ["Sport & date", "Time slot", "Summary", "Payment", "Confirmed"];

export function Stepper({ current }: { current: number }) {
  return (
    <ol className="no-scrollbar flex items-center gap-2 overflow-x-auto overscroll-x-contain">
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
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto overscroll-x-contain pb-1">
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
  pointsUsed = 0,
  courtName,
  invoice,
}: {
  venue: VenueDetail;
  sport: string;
  date: string;
  slots: Slot[];
  breakdown: PriceBreakdown;
  creditApplied?: number;
  pointsUsed?: number;
  courtName?: string | null;
  /** GST invoice option — omitted when signed out. */
  invoice?: {
    profile: { companyName: string; gstNumber: string } | null;
    checked: boolean;
    onChange: (v: boolean) => void;
  };
}) {
  const rows: Array<[string, string]> = [
    ["Venue", venue.name],
    ["Area", `${venue.area}, Kanpur`],
    ["Sport", sport],
    ...(courtName ? ([["Turf", courtName]] as Array<[string, string]>) : []),
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
      {invoice ? (
        <div className="surface-card rounded-2xl p-4">
          {invoice.profile ? (
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={invoice.checked}
                onChange={(e) => invoice.onChange(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--primary)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Need a GST invoice?</span>
                <span className="block text-xs text-muted-foreground">
                  Share {invoice.profile.companyName} · {invoice.profile.gstNumber} with the venue.
                  The venue issues the invoice.
                </span>
              </span>
            </label>
          ) : (
            <p className="text-xs text-muted-foreground">
              Booking for your company?{" "}
              <Link to="/corporate-profile" className="font-semibold text-primary hover:underline">
                Add your corporate profile
              </Link>{" "}
              to get a GST invoice.
            </p>
          )}
        </div>
      ) : null}
      <PriceCard breakdown={breakdown} creditApplied={creditApplied} pointsUsed={pointsUsed} />
    </div>
  );
}

export function PriceCard({
  breakdown,
  creditApplied = 0,
  pointsUsed = 0,
}: {
  breakdown: PriceBreakdown;
  creditApplied?: number;
  pointsUsed?: number;
}) {
  const payable = Math.max(0, breakdown.total - creditApplied);
  return (
    <div className="surface-card rounded-2xl p-4">
      <h3 className="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        Price breakdown
      </h3>
      <div className="flex flex-col gap-2 text-sm">
        <Row
          label={`Slot charges (${formatDuration(breakdown.durationMinutes)})`}
          value={formatINR(breakdown.basePrice)}
        />
        <Row label="Platform fee (5%)" value={formatINR(breakdown.platformFee)} />
        <Row label="GST (18%)" value={formatINR(breakdown.gst)} />
        {creditApplied > 0 ? (
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
              <Gift className="h-3.5 w-3.5" /> Reward points{pointsUsed > 0 ? ` (${pointsUsed.toLocaleString("en-IN")} pts)` : ""}
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

export type PointsRedeemProps = {
  balance: number;
  /** Highest points usable on this booking under the admin's rules. */
  maxPoints: number;
  /** ₹ discount that maximum gives. */
  maxCreditInr: number;
  maxPercent: number;
  minPoints: number;
  enabled: boolean;
  onToggle: (on: boolean) => void;
};

function PointsRedeemCard({
  balance,
  maxPoints,
  maxCreditInr,
  maxPercent,
  minPoints,
  enabled,
  onToggle,
}: PointsRedeemProps) {
  if (balance <= 0) return null;
  const usable = maxPoints > 0 && maxPoints >= minPoints;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Gift className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {usable
            ? `Use ${maxPoints.toLocaleString("en-IN")} points — save ${formatINR(maxCreditInr)}`
            : `You have ${balance.toLocaleString("en-IN")} reward points`}
        </p>
        <p className="text-xs text-muted-foreground">
          {usable
            ? `You have ${balance.toLocaleString("en-IN")} pts · up to ${maxPercent}% of a booking`
            : minPoints > balance
              ? `You need at least ${minPoints.toLocaleString("en-IN")} points to redeem`
              : "Points can't be used on this booking"}
        </p>
      </div>
      {usable ? (
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Use reward points"
          onClick={() => onToggle(!enabled)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            enabled ? "bg-primary" : "bg-border",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
              enabled ? "left-[22px]" : "left-0.5",
            )}
          />
        </button>
      ) : null}
    </div>
  );
}

export function PaymentStep({
  method,
  onMethodChange,
  breakdown,
  upiId,
  onUpiIdChange,
  error,
  creditApplied = 0,
  pointsUsed = 0,
  points,
  savedUpiMethods = [],
}: {
  method: PaymentMethod;
  onMethodChange: (m: PaymentMethod) => void;
  breakdown: PriceBreakdown;
  upiId: string;
  onUpiIdChange: (v: string) => void;
  error?: string | null;
  creditApplied?: number;
  pointsUsed?: number;
  /** Reward-points redemption controls (hidden when the program is off). */
  points?: PointsRedeemProps;
  /** Saved UPI IDs from the user's profile — shown as quick-select chips
   *  so returning users don't have to retype a UPI ID every checkout. */
  savedUpiMethods?: { id: string; maskedIdentifier: string; isDefault: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-2xl leading-none">Payment</h2>

      {points ? <PointsRedeemCard {...points} /> : null}

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
            {savedUpiMethods.length > 0 ? (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Saved UPI IDs
                </span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {savedUpiMethods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => onUpiIdChange(m.maskedIdentifier)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                        upiId === m.maskedIdentifier
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface text-muted-foreground hover:border-primary hover:text-primary",
                      )}
                    >
                      {m.maskedIdentifier}
                      {m.isDefault ? " · Default" : ""}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
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

      <PriceCard breakdown={breakdown} creditApplied={creditApplied} pointsUsed={pointsUsed} />
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