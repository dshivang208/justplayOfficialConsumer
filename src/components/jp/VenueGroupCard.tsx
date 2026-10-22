import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Megaphone, Users } from "lucide-react";
import { Button } from "@/components/jp/Button";
import { useAuth } from "@/lib/auth";
import { useAuthAction } from "@/lib/use-auth-action";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchVenueGroup,
  fetchVenueGroupUpdates,
  joinVenueGroup,
  leaveVenueGroup,
  type VenueGroup,
  type VenueGroupUpdate,
} from "@/lib/venueGroup";

/**
 * The venue's optional community group, shown on that venue's detail page
 * only. Renders NOTHING unless the venue has a live group (admin enabled the
 * facility + owner created it + not paused) — so for most venues the page is
 * exactly as it was before.
 *
 * Anyone can see the group exists and join it; the updates feed itself is
 * members-only (enforced by RLS, not just hidden here) and read-only — only
 * the venue owner posts, from the Partner app.
 */
export function VenueGroupCard({ venueId, venueName }: { venueId: string; venueName: string }) {
  const { user } = useAuth();
  const runWithAuth = useAuthAction();
  const [group, setGroup] = useState<VenueGroup | null>(null);
  const [updates, setUpdates] = useState<VenueGroupUpdate[]>([]);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const userId = user?.id ?? null;

  const reloadGroup = useCallback(async () => {
    setGroup(await fetchVenueGroup(venueId));
  }, [venueId]);

  // Re-run on sign-in/out: `is_member` depends on who's asking.
  useEffect(() => {
    let active = true;
    void fetchVenueGroup(venueId).then((g) => {
      if (active) setGroup(g);
    });
    return () => {
      active = false;
    };
  }, [venueId, userId]);

  const groupId = group?.id ?? null;
  const isMember = group?.isMember ?? false;

  // Members: load the feed and stay subscribed while the page is open.
  useEffect(() => {
    if (!groupId || !isMember) {
      setUpdates([]);
      return;
    }
    let active = true;
    const load = () =>
      fetchVenueGroupUpdates(groupId).then((u) => {
        if (active) setUpdates(u);
      });
    void load();

    const channel = supabase
      .channel(`venue-group-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "venue_group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        () => void load(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [groupId, isMember]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [updates.length]);

  if (!group) return null;

  const join = () =>
    runWithAuth(() => {
      setBusy(true);
      joinVenueGroup(group.id)
        .then(reloadGroup)
        .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't join."))
        .finally(() => setBusy(false));
    });

  const leave = () => {
    setBusy(true);
    leaveVenueGroup(group.id)
      .then(reloadGroup)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Couldn't leave."))
      .finally(() => setBusy(false));
  };

  return (
    <section
      className="surface-card rounded-2xl p-4 sm:p-5"
      aria-label={`${venueName} updates group`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Megaphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl leading-none">{group.name}</h2>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"} · updates from{" "}
            {venueName}
          </p>
          {group.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{group.description}</p>
          ) : null}
        </div>
        {group.isMember ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={leave}>
            Leave
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={join}>
            {busy ? "Joining…" : "Join group"}
          </Button>
        )}
      </div>

      {group.isMember ? (
        <div
          ref={listRef}
          className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-3"
        >
          {updates.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No updates yet — you&apos;ll see them here as soon as {venueName} posts.
            </p>
          ) : (
            updates.map((u) => (
              <div key={u.id} className="flex flex-col items-start">
                <div className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-surface px-3.5 py-2 text-sm text-foreground">
                  {u.body}
                </div>
                <span className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(u.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Join to get offers, closures and news from {venueName} right here. Only the venue posts.
        </p>
      )}
    </section>
  );
}