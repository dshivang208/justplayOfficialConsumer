import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, Users } from "lucide-react";
import { PageShell } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { JustPlayMark } from "@/components/jp/JustPlayMark";
import { VenueGroupChat } from "@/components/jp/VenueGroupChat";
import { fetchVenue } from "@/data/venues";
import { useAuth } from "@/lib/auth";
import {
  fetchVenueGroup,
  joinVenueGroup,
  leaveVenueGroup,
  type VenueGroup,
} from "@/lib/venueGroup";

export const Route = createFileRoute("/venue-group/$venueId")({
  loader: async ({ params }) => {
    const venue = await fetchVenue(params.venueId);
    if (!venue) throw notFound();
    return { venue: { id: venue.id, name: venue.name } };
  },
  head: () => ({
    meta: [{ title: "Venue group chat | JustPlay" }, { name: "robots", content: "noindex" }],
  }),
  notFoundComponent: () => (
    <PageShell>
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-4xl">Group not found</h1>
        <Button asChild className="mt-6">
          <Link to="/venues">Browse venues</Link>
        </Button>
      </div>
    </PageShell>
  ),
  component: VenueGroupPage,
});

function VenueGroupPage() {
  const { venue } = Route.useLoaderData();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? null;
  const [group, setGroup] = useState<VenueGroup | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setGroup(await fetchVenueGroup(venue.id));
    setLoaded(true);
  }, [venue.id]);

  useEffect(() => {
    void reload();
  }, [reload, userId]);

  const back = (
    <Link
      to="/venues/$venueId"
      params={{ venueId: venue.id }}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" /> Back to {venue.name}
    </Link>
  );

  if (!loaded) {
    return (
      <PageShell>
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Loading group…
        </div>
      </PageShell>
    );
  }

  if (!group) {
    return (
      <PageShell>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-3xl">This group isn't available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {venue.name} doesn't have an open community group right now.
          </p>
          <div className="mt-6 flex justify-center">{back}</div>
        </div>
      </PageShell>
    );
  }

  const join = async () => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: `/venue-group/${venue.id}` } });
      return;
    }
    setBusy(true);
    try {
      await joinVenueGroup(group.id);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't join.");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await leaveVenueGroup(group.id);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't leave.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        {back}
        <header className="mt-4 flex items-center gap-3 sm:gap-4">
          <JustPlayMark className="h-14 w-14 text-3xl" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl leading-none sm:text-3xl">{group.name}</h1>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {group.memberCount} {group.memberCount === 1 ? "member" : "members"} · group by{" "}
              {venue.name}
            </p>
          </div>
          {group.isMember ? (
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void leave()}>
              Leave
            </Button>
          ) : null}
        </header>
        {group.description ? (
          <p className="mt-3 text-sm text-muted-foreground">{group.description}</p>
        ) : null}

        <div className="mt-5">
          {group.isMember ? (
            <VenueGroupChat group={group} venueName={venue.name} />
          ) : (
            <div className="surface-card rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Join to chat with {venue.name} and other players, share photos, videos and files,
                and get offers, closures and news.
              </p>
              <Button className="mt-4" disabled={busy} onClick={() => void join()}>
                {busy ? "Joining…" : "Join group"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
