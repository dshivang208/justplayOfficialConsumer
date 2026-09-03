import type { Slot } from "@/data/venues";
import { cn } from "@/lib/utils";

export function SlotLegend() {
  const items = [
    { label: "Available", cls: "border-border bg-surface" },
    { label: "Selected", cls: "border-primary bg-primary" },
    { label: "Booked", cls: "border-transparent bg-muted" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded border", i.cls)} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function SlotGrid({
  slots,
  selectedIds,
  onToggle,
}: {
  slots: Slot[];
  selectedIds: string[];
  onToggle: (slot: Slot) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {slots.map((slot) => {
        const selected = selectedIds.includes(slot.id);
        const booked = slot.status === "booked";
        return (
          <button
            key={slot.id}
            type="button"
            disabled={booked}
            aria-pressed={selected}
            onClick={() => onToggle(slot)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-xs font-semibold transition-all",
              booked &&
                "cursor-not-allowed border-transparent bg-muted text-muted-foreground line-through opacity-70",
              !booked &&
                !selected &&
                "border-border bg-surface text-foreground hover:-translate-y-0.5 hover:border-primary hover:text-primary",
              selected && "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-glow)]",
            )}
          >
            <span>{slot.label}</span>
            <span
              className={cn(
                "text-[10px] font-bold",
                selected ? "text-primary-foreground/90" : "text-muted-foreground",
              )}
            >
              ₹{slot.price}
            </span>
          </button>
        );
      })}
    </div>
  );
}
