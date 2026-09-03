import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, List, MapPin, SlidersHorizontal, Search } from "lucide-react";
import { Navbar } from "@/components/jp/Navbar";
import { Footer } from "@/components/jp/Footer";
import { Button } from "@/components/jp/Button";
import { VenueCard } from "@/components/jp/VenueCard";
import { EmptyState, SkeletonGrid } from "@/components/jp/states";
import {
  VenueFilters,
  defaultFilters,
  type VenueFilterState,
} from "@/components/jp/VenueFilters";
import { fetchVenues, type VenueDetail } from "@/data/venues";

export const Route = createFileRoute("/venues/")({
  head: () => ({
    meta: [
      { title: "Sports Venues in Kanpur — Turfs & Courts | JustPlay" },
      {
        name: "description",
        content:
          "Search verified turfs, box cricket cages and courts across Kanpur. Filter by sport, area, price and amenities, then book a slot in under a minute.",
      },
      { property: "og:title", content: "Sports Venues in Kanpur — Turfs & Courts | JustPlay" },
      {
        property: "og:description",
        content: "Filter Kanpur venues by sport, price, distance and amenities — book instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VenueDiscovery,
});

type SortKey = "price" | "distance" | "rating";

const sortLabels: Record<SortKey, string> = {
  price: "Price: low to high",
  distance: "Nearest first",
  rating: "Top rated",
};

function VenueDiscovery() {
  const [filters, setFilters] = useState<VenueFilterState>(defaultFilters);
  const [sort, setSort] = useState<SortKey>("distance");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [allVenues, setAllVenues] = useState<VenueDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetchVenues().then((venues) => {
      if (!active) return;
      setAllVenues(venues);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = allVenues.filter((v) => {
      if (q && !`${v.name} ${v.area} ${v.sports.join(" ")}`.toLowerCase().includes(q)) return false;
      if (filters.sport && !v.sports.includes(filters.sport)) return false;
      if (filters.area && v.area !== filters.area) return false;
      if (v.pricePerHour > filters.maxPrice) return false;
      if (v.distanceKm > filters.maxDistance) return false;
      if (filters.amenities.some((a) => !v.amenities.includes(a))) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === "price") return a.pricePerHour - b.pricePerHour;
      if (sort === "rating") return b.rating - a.rating;
      return a.distanceKm - b.distanceKm;
    });
  }, [filters, sort, query]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="border-b border-border bg-surface-raised/60">
          <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-10">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <MapPin className="h-3.5 w-3.5" /> Kanpur
            </span>
            <h1 className="mt-2 text-4xl leading-none sm:text-5xl">Find your ground</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              {allVenues.length} verified venues across the city. Filter, compare and lock a slot.
            </p>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-primary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search venue, area or sport…"
                aria-label="Search venues"
                className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[260px_1fr]">
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <VenueFilters value={filters} onChange={setFilters} />
            </div>
          </div>

          {showFilters ? (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4 backdrop-blur lg:hidden">
              <VenueFilters
                value={filters}
                onChange={setFilters}
                onClose={() => setShowFilters(false)}
              />
            </div>
          ) : null}

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                <span className="font-bold text-foreground">{results.length}</span> venues
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setShowFilters(true)}
                >
                  <SlidersHorizontal className="h-4 w-4" /> Filters
                </Button>

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Sort venues"
                  className="h-9 rounded-full border border-border bg-surface px-3 text-xs font-semibold outline-none"
                >
                  {(Object.keys(sortLabels) as SortKey[]).map((k) => (
                    <option key={k} value={k}>
                      {sortLabels[k]}
                    </option>
                  ))}
                </select>

                <div className="flex overflow-hidden rounded-full border border-border">
                  <button
                    type="button"
                    aria-label="Grid view"
                    onClick={() => setView("grid")}
                    className={
                      view === "grid"
                        ? "bg-primary p-2 text-primary-foreground"
                        : "bg-surface p-2 text-muted-foreground"
                    }
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="List view"
                    onClick={() => setView("list")}
                    className={
                      view === "list"
                        ? "bg-primary p-2 text-primary-foreground"
                        : "bg-surface p-2 text-muted-foreground"
                    }
                  >
                    <List className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {isLoading ? (
              <SkeletonGrid count={6} />
            ) : results.length === 0 ? (
              <EmptyState
                icon={<MapPin className="h-8 w-8" />}
                title="No venues found in this area yet"
                description="Try adjusting your filters — widen the distance or price range."
                action={
                  <Button variant="outline" onClick={() => setFilters(defaultFilters)}>
                    Reset filters
                  </Button>
                }
              />
            ) : view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((v) => (
                  <VenueCard key={v.id} venue={v} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {results.map((v) => (
                  <VenueCard key={v.id} venue={v} view="list" />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}