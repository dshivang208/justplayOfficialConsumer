import { SlidersHorizontal, X } from "lucide-react";
import { areas, sports } from "@/data/landing";
import { amenityList, type Amenity } from "@/data/venues";
import { Button } from "./Button";

export type VenueFilterState = {
  sport: string;
  area: string;
  maxPrice: number;
  maxDistance: number;
  amenities: Amenity[];
};

// NOTE: these are only the *initial* fallback bounds shown before real venue
// data has loaded. venues/index.tsx recomputes maxPrice/maxDistance from the
// actual fetched venues (rounded up) once they arrive, so a venue priced or
// located beyond these numbers is never silently hidden — see
// computeFilterCeilings() below and its use in VenueDiscovery.
export const defaultFilters: VenueFilterState = {
  sport: "",
  area: "",
  maxPrice: 1500,
  maxDistance: 15,
  amenities: [],
};

/** Derives safe slider ceilings from the real dataset so venues priced or
 *  located beyond the old hardcoded 1500/15 defaults are never invisible. */
export function computeFilterCeilings(venues: { pricePerHour: number; distanceKm: number }[]) {
  const priceMax = venues.reduce((m, v) => Math.max(m, v.pricePerHour), 0);
  const distanceMax = venues.reduce((m, v) => Math.max(m, v.distanceKm), 0);
  return {
    // Round up to the nearest 100/5 and always keep at least the old
    // baseline so the slider never feels cramped on a small dataset.
    maxPrice: Math.max(1500, Math.ceil((priceMax || 0) / 100) * 100),
    maxDistance: Math.max(15, Math.ceil((distanceMax || 0) / 5) * 5),
  };
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          : "rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      }
    >
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border pb-5 last:border-0 last:pb-0">
      <h3 className="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function VenueFilters({
  value,
  onChange,
  onClose,
  priceCeiling = 1500,
  distanceCeiling = 15,
}: {
  value: VenueFilterState;
  onChange: (next: VenueFilterState) => void;
  onClose?: () => void;
  /** Slider upper bound for price — pass computeFilterCeilings(venues).maxPrice
   *  so a venue priced above the old 1500 default is still reachable. */
  priceCeiling?: number;
  /** Slider upper bound for distance — same idea, for km. */
  distanceCeiling?: number;
}) {
  const set = <K extends keyof VenueFilterState>(key: K, v: VenueFilterState[K]) =>
    onChange({ ...value, [key]: v });

  const toggleAmenity = (a: Amenity) =>
    set(
      "amenities",
      value.amenities.includes(a)
        ? value.amenities.filter((x) => x !== a)
        : [...value.amenities, a],
    );

  return (
    <aside className="surface-card flex flex-col gap-5 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <SlidersHorizontal className="h-4 w-4 text-primary" /> Filters
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(defaultFilters)}
            className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Reset
          </button>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Close filters" className="lg:hidden">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : null}
        </div>
      </div>

      <Group title="Sport">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={value.sport === ""} onClick={() => set("sport", "")}>
            All
          </Chip>
          {sports.slice(0, 8).map((s) => (
            <Chip key={s.id} active={value.sport === s.name} onClick={() => set("sport", s.name)}>
              {s.name}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Area in Kanpur">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={value.area === ""} onClick={() => set("area", "")}>
            Anywhere
          </Chip>
          {areas.map((a) => (
            <Chip key={a} active={value.area === a} onClick={() => set("area", a)}>
              {a}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title={`Max price · ₹${value.maxPrice} / hour`}>
        <input
          type="range"
          min={300}
          max={priceCeiling}
          step={50}
          value={value.maxPrice}
          onChange={(e) => set("maxPrice", Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
          aria-label="Maximum price per hour"
        />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>₹300</span>
          <span>₹{priceCeiling}+</span>
        </div>
      </Group>

      <Group title={`Within ${value.maxDistance} km`}>
        <input
          type="range"
          min={1}
          max={distanceCeiling}
          step={1}
          value={value.maxDistance}
          onChange={(e) => set("maxDistance", Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
          aria-label="Maximum distance in kilometres"
        />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>1 km</span>
          <span>{distanceCeiling} km</span>
        </div>
      </Group>

      <Group title="Amenities">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {amenityList.map((a) => (
            <label key={a} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.amenities.includes(a)}
                onChange={() => toggleAmenity(a)}
                className="h-4 w-4 rounded border-border accent-[var(--primary)]"
              />
              <span className="text-muted-foreground">{a}</span>
            </label>
          ))}
        </div>
      </Group>

      {onClose ? (
        <Button className="lg:hidden" onClick={onClose}>
          Show results
        </Button>
      ) : null}
    </aside>
  );
}