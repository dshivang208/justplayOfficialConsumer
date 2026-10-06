import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MapPin, Star, Clock, ArrowLeft, Check, ParkingCircle, Navigation } from "lucide-react";
import { Navbar } from "@/components/jp/Navbar";
import { Footer } from "@/components/jp/Footer";
import { Button } from "@/components/jp/Button";
import { SportTag } from "@/components/jp/SportTag";
import { VenueMap } from "@/components/jp/VenueMap";
import { useEffect, useState } from "react";
import {
  fetchVenue,
  fetchVenues,
  fetchReviews,
  fetchMoreReviews,
  getMyReviewStatus,
  submitReview,
  deleteReview,
  formatReviewDate,
  type VenueDetail,
  type Review,
  type ReviewEligibility,
} from "@/data/venues";
import { RatingBadge } from "@/components/jp/VenueCard";
import { formatINR } from "@/lib/booking";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/venues/$venueId")({
  loader: async ({ params }) => {
    const venue = await fetchVenue(params.venueId);
    if (!venue) throw notFound();
    return { venue };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Venue not found | JustPlay" }, { name: "robots", content: "noindex" }],
      };
    }
    const v = loaderData.venue;
    const title = `${v.name}, ${v.area} — Book Slots | JustPlay Kanpur`;
    const description = `${v.tagline}. ${v.sports.join(", ")} from ₹${v.pricePerHour}/hour in ${v.area}, Kanpur. Instant slot booking on JustPlay.`;
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
  pendingComponent: VenueDetailSkeleton,
  notFoundComponent: VenueNotFound,
  component: VenueDetailPage,
});

function VenueDetailSkeleton() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto w-full max-w-6xl animate-pulse px-4 py-8 sm:px-6">
        <div className="aspect-[16/9] w-full rounded-2xl bg-muted" />
        <div className="mt-6 h-8 w-2/3 rounded bg-muted" />
        <div className="mt-3 h-4 w-1/3 rounded bg-muted" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="h-40 rounded-2xl bg-muted" />
          <div className="h-40 rounded-2xl bg-muted" />
        </div>
      </div>
    </div>
  );
}

function VenueNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center px-4 py-24 text-center">
        <div>
          <h1 className="text-4xl">Venue not found</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This ground may have been removed. Browse the rest of Kanpur.
          </p>
          <Button asChild className="mt-6">
            <Link to="/venues">All venues</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card rounded-2xl p-4 sm:p-5">
      <h2 className="mb-3 text-2xl leading-none">{title}</h2>
      {children}
    </section>
  );
}

/** Tap-to-rate 1–5 stars. */
function StarRatingInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors",
              n <= value ? "fill-accent text-accent" : "fill-transparent text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}

function VenueDetailPage() {
  const { venue } = Route.useLoaderData();
  const { user, isAuthenticated } = useAuth();
  const [cover, ...rest] = venue.gallery;
  const [similar, setSimilar] = useState<VenueDetail[]>([]);

  useEffect(() => {
    let active = true;
    fetchVenues().then((venues) => {
      if (active) setSimilar(venues.filter((v) => v.id !== venue.id).slice(0, 3));
    });
    return () => {
      active = false;
    };
  }, [venue.id]);

  // --- Reviews ------------------------------------------------------------
  const [reviews, setReviews] = useState<Review[]>([]);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [eligibility, setEligibility] = useState<ReviewEligibility>({
    canReview: false,
    existingRating: null,
    existingBody: null,
  });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formBody, setFormBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const viewerId = user?.id ?? null;
    fetchReviews(venue.id, viewerId).then(({ reviews: r, hasMore }) => {
      if (!active) return;
      setReviews(r);
      setHasMoreReviews(hasMore);
    });
    if (isAuthenticated) {
      getMyReviewStatus(venue.id).then((status) => {
        if (!active) return;
        setEligibility(status);
        if (status.existingRating != null) {
          setFormRating(status.existingRating);
          setFormBody(status.existingBody ?? "");
        }
      });
    }
    return () => {
      active = false;
    };
  }, [venue.id, user?.id, isAuthenticated]);

  const handleShowMoreReviews = async () => {
    setLoadingMore(true);
    try {
      const { reviews: more, hasMore } = await fetchMoreReviews(venue.id, reviews.length, user?.id ?? null);
      setReviews((prev) => [...prev, ...more]);
      setHasMoreReviews(hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const refreshReviews = async () => {
    const { reviews: r, hasMore } = await fetchReviews(venue.id, user?.id ?? null);
    setReviews(r);
    setHasMoreReviews(hasMore);
  };

  const handleSubmitReview = async () => {
    if (formRating === 0) {
      setReviewError("Pick a star rating first.");
      return;
    }
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await submitReview(venue.id, formRating, formBody);
      await refreshReviews();
      setEligibility((prev) => ({ ...prev, existingRating: formRating, existingBody: formBody || null }));
      setShowReviewForm(false);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Could not submit your review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await deleteReview(venue.id);
      await refreshReviews();
      setEligibility((prev) => ({ ...prev, existingRating: null, existingBody: null }));
      setFormRating(0);
      setFormBody("");
      setShowReviewForm(false);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Could not delete your review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 lg:pb-0">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <Link
          to="/venues"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All venues
        </Link>

        {/* Gallery */}
        <div className="grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
          <div className="overflow-hidden rounded-2xl sm:col-span-2 sm:row-span-2">
            <img
              src={cover}
              alt={`${venue.name} main view`}
              className="h-56 w-full object-cover sm:h-full"
            />
          </div>
          {rest.slice(0, 4).map((g, i) => (
            <div key={i} className="hidden overflow-hidden rounded-2xl sm:block">
              <img
                src={g}
                alt={`${venue.name} photo ${i + 2}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex min-w-0 flex-col gap-5">
            <header>
              <div className="flex flex-wrap items-center gap-2">
                {venue.sports.map((s) => (
                  <SportTag key={s} sport={s} />
                ))}
                <span
                  className={
                    venue.isOpenNow
                      ? "rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-primary"
                      : "rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
                  }
                >
                  {venue.isOpenNow ? "Open now" : "Closed"}
                </span>
              </div>
              <h1 className="mt-3 text-4xl leading-none sm:text-5xl">{venue.name}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{venue.tagline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <RatingBadge rating={venue.rating} iconClassName="h-3.5 w-3.5" />
                  <span className="font-medium text-muted-foreground">
                    {venue.rating != null
                      ? `(${venue.reviewCount} ${venue.reviewCount === 1 ? "review" : "reviews"})`
                      : "No reviews yet"}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {venue.area} · {venue.distanceKm} km
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {venue.openingHours}
                </span>
              </div>
            </header>

            <Card title="About this venue">
              <p className="text-sm leading-relaxed text-muted-foreground">{venue.about}</p>
            </Card>

            <Card title="Amenities">
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {venue.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                    {a}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Pricing">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 font-bold">Sport</th>
                      <th className="pb-2 font-bold">Slot</th>
                      <th className="pb-2 font-bold">Hours</th>
                      <th className="pb-2 text-right font-bold">Per hour</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venue.pricing.map((p, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 font-semibold">{p.sport}</td>
                        <td className="py-2.5 text-muted-foreground">{p.slotType}</td>
                        <td className="py-2.5 text-muted-foreground">{p.hours}</td>
                        <td className="py-2.5 text-right font-bold">{formatINR(p.pricePerHour)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Location">
              <p className="text-sm text-muted-foreground">{venue.address}</p>
              <div className="mt-3">
                <VenueMap latitude={venue.latitude} longitude={venue.longitude} name={venue.name} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
                  <ParkingCircle className="h-3.5 w-3.5 text-primary" /> On-site parking
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5">
                  <Navigation className="h-3.5 w-3.5 text-primary" /> {venue.distanceKm} km from you
                </span>
              </div>
            </Card>

            <Card title="Reviews">
              <div className="flex flex-col gap-4">
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No reviews yet — be the first to share how it went.
                  </p>
                ) : (
                  reviews.map((r) => (
                    <div key={r.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {r.initials}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {r.authorName}
                            {r.isMine && (
                              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatReviewDate(r.createdAt)}
                          </p>
                        </div>
                        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-bold text-accent">
                          <Star className="h-3.5 w-3.5 fill-current" /> {r.rating}.0
                        </span>
                      </div>
                      {r.body && (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
                      )}
                    </div>
                  ))
                )}

                {hasMoreReviews && (
                  <Button variant="outline" size="sm" disabled={loadingMore} onClick={handleShowMoreReviews}>
                    {loadingMore ? "Loading…" : "Show more reviews"}
                  </Button>
                )}
              </div>

              {isAuthenticated && eligibility.canReview && (
                <div className="mt-5 border-t border-border pt-4">
                  {!showReviewForm ? (
                    <Button variant="outline" size="sm" onClick={() => setShowReviewForm(true)}>
                      {eligibility.existingRating != null ? "Edit your review" : "Write a review"}
                    </Button>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="mb-1.5 text-sm font-semibold text-foreground">Your rating</p>
                        <StarRatingInput value={formRating} onChange={setFormRating} />
                      </div>
                      <textarea
                        value={formBody}
                        maxLength={1000}
                        onChange={(e) => setFormBody(e.target.value)}
                        placeholder="How was it? (optional)"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
                      />
                      {reviewError && <p className="text-sm text-destructive">{reviewError}</p>}
                      <div className="flex items-center gap-2">
                        <Button size="sm" disabled={submittingReview} onClick={handleSubmitReview}>
                          {submittingReview ? "Saving…" : "Submit review"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={submittingReview}
                          onClick={() => {
                            setShowReviewForm(false);
                            setReviewError(null);
                          }}
                        >
                          Cancel
                        </Button>
                        {eligibility.existingRating != null && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto text-destructive"
                            disabled={submittingReview}
                            onClick={handleDeleteReview}
                          >
                            Delete review
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            <section>
              <h2 className="mb-3 text-2xl leading-none">Similar venues nearby</h2>
              <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 sm:mx-0 sm:px-0">
                {similar.map((v) => (
                  <Link
                    key={v.id}
                    to="/venues/$venueId"
                    params={{ venueId: v.id }}
                    className="surface-card w-40 shrink-0 snap-start overflow-hidden rounded-xl transition-colors hover:border-primary/60 sm:w-52"
                  >
                    <img
                      src={v.image}
                      alt={v.name}
                      loading="lazy"
                      className="h-24 w-full object-cover"
                    />
                    <div className="p-3">
                      <p className="truncate text-sm font-semibold">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {v.area} · {formatINR(v.pricePerHour)}/hr
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* Desktop booking card */}
          <aside className="hidden lg:block">
            <div className="surface-card sticky top-20 rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Starting from
              </p>
              <p className="mt-1 text-3xl font-display">
                {formatINR(venue.pricePerHour)}
                <span className="text-sm font-sans font-medium text-muted-foreground"> / hour</span>
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Free cancellation up to 4 hours before your slot.
              </p>
              <Button asChild size="lg" className="mt-4 w-full">
                <Link to="/book/$venueId" params={{ venueId: venue.id }}>
                  Book Now
                </Link>
              </Button>
            </div>
          </aside>
        </div>
      </main>

      {/* Mobile sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div>
            <p className="text-lg font-bold leading-none">{formatINR(venue.pricePerHour)}</p>
            <p className="text-[11px] text-muted-foreground">per hour · free cancellation</p>
          </div>
          <Button asChild size="lg">
            <Link to="/book/$venueId" params={{ venueId: venue.id }}>
              Book Now
            </Link>
          </Button>
        </div>
      </div>

      <div className="hidden lg:block">
        <Footer />
      </div>
    </div>
  );
}