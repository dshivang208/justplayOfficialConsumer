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

export const defaultFilters: VenueFilterState = {
  sport: "",
  area: "",
  maxPrice: 1500,
  maxDistance: 15,
  amenities: [],
};

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
}: {
  value: VenueFilterState;
  onChange: (next: VenueFilterState) => void;
  onClose?: () => void;
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
          max={1500}
          step={50}
          value={value.maxPrice}
          onChange={(e) => set("maxPrice", Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
          aria-label="Maximum price per hour"
        />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>₹300</span>
          <span>₹1500+</span>
        </div>
      </Group>

      <Group title={`Within ${value.maxDistance} km`}>
        <input
          type="range"
          min={1}
          max={15}
          step={1}
          value={value.maxDistance}
          onChange={(e) => set("maxDistance", Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
          aria-label="Maximum distance in kilometres"
        />
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>1 km</span>
          <span>15 km</span>
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
