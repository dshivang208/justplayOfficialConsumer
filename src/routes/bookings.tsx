import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarX2, Loader2 } from "lucide-react";
import { Navbar } from "@/components/jp/Navbar";
import { Footer } from "@/components/jp/Footer";
import { Button } from "@/components/jp/Button";
import { BookingCard } from "@/components/jp/BookingCard";
import { cancelBooking, fetchMyBookings, isUpcoming, type Booking } from "@/data/bookings";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bookings")({
  head: () => {
    const title = "My Bookings — upcoming & past games | JustPlay";
    const description =
      "Track your JustPlay slots in Kanpur: view upcoming bookings, cancel a slot, and rebook past games in a tap.";
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
  component: BookingsPage,
});

function BookingsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, hydrated } = useAuth();
  const [list, setList] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchMyBookings().then((bookings) => {
      if (active) {
        setList(bookings);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const upcoming = useMemo(() => list.filter((b) => isUpcoming(b)), [list]);
  const past = useMemo(
    () => list.filter((b) => !isUpcoming(b)).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [list],
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 text-center">
          <h1 className="text-4xl leading-none">Log in to see your bookings</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your slots, receipts and cancellations live behind your phone number.
          </p>
          <Button
            className="mt-6"
            size="lg"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/bookings" } })}
          >
            Log in with phone
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const current = tab === "upcoming" ? upcoming : past;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-4xl leading-none sm:text-5xl">My Bookings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every slot you've locked in Kanpur — past and upcoming.
        </p>

        <div className="mt-6 inline-flex rounded-full border border-border bg-surface p-1">
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors",
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t} ({t === "upcoming" ? upcoming.length : past.length})
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {loading ? (
            <div className="flex justify-center py-14">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : current.length === 0 ? (
            <div className="surface-card flex flex-col items-center rounded-2xl px-6 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <CalendarX2 className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-2xl leading-none">
                {tab === "upcoming" ? "No upcoming bookings" : "No past games yet"}
              </h2>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {tab === "upcoming"
                  ? "Go find a venue and get your crew on the turf."
                  : "Once you play your first game it'll show up here."}
              </p>
              <Button asChild className="mt-5">
                <Link to="/venues">Find a venue</Link>
              </Button>
            </div>
          ) : (
            current.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                variant={tab}
                onCancel={async (booking) => {
                  await cancelBooking(booking.id);
                  const fresh = await fetchMyBookings();
                  setList(fresh);
                }}
              />
            ))
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}