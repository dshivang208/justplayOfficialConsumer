import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Phone, UserMinus, UserPlus, Users } from "lucide-react";
import { PageShell, PageHeader } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { EmptyState } from "@/components/jp/states";
import { useAuth } from "@/lib/auth";
import {
  fetchFriendRequests,
  fetchFriends,
  phone10,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  type Friend,
  type FriendRequest,
} from "@/lib/friends";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "My Friends | JustPlay" },
      { name: "description", content: "Your JustPlay friends — add by mobile number and invite them to games." },
    ],
  }),
  component: FriendsPage,
});

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function FriendsPage() {
  const { isAuthenticated, hydrated } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Friend | null>(null);

  const reload = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([fetchFriends(), fetchFriendRequests()]);
      setFriends(f);
      setRequests(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load your friends.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: "/friends" } });
      return;
    }
    if (isAuthenticated) void reload();
  }, [hydrated, isAuthenticated, navigate, reload]);

  const add = async () => {
    if (phone10(phone).length !== 10) return void toast.error("Enter a 10-digit mobile number.");
    setBusy(true);
    try {
      const r = await sendFriendRequest(phone);
      const msg = {
        sent: "Friend request sent.",
        accepted: "You're now friends!",
        already_friends: "Already in your friends list.",
        already_pending: "Request already sent — waiting for them to accept.",
        not_found: "That number isn't on JustPlay yet.",
        self: "That's your own number 🙂",
      }[r];
      (r === "sent" || r === "accepted" ? toast.success : toast.message)(msg);
      if (r === "sent" || r === "accepted") setPhone("");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell>
      <PageHeader eyebrow="Community" title="My Friends" subtitle="People you play with. Invite them to any game you host." />

      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <div className="surface-card rounded-2xl p-4">
          <h2 className="text-lg">Add a friend</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Enter their JustPlay mobile number.</p>
          <div className="mt-3 flex gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void add()}
                inputMode="tel"
                placeholder="Mobile number"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <Button onClick={add} disabled={busy}>
              <UserPlus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>

        {requests.length > 0 ? (
          <section>
            <h2 className="text-lg">Friend requests ({requests.length})</h2>
            <div className="mt-2 space-y-2">
              {requests.map((r) => (
                <div key={r.requestId} className="surface-card flex items-center gap-3 rounded-xl p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                    {initials(r.name)}
                  </span>
                  <span className="flex-1 truncate text-sm font-semibold">{r.name}</span>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await respondFriendRequest(r.requestId, true).catch(() => toast.error("Couldn't accept."));
                      await reload();
                    }}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await respondFriendRequest(r.requestId, false).catch(() => toast.error("Couldn't ignore."));
                      await reload();
                    }}
                  >
                    Ignore
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="text-lg">Friends ({friends.length})</h2>
          {loading ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
          ) : friends.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                title="No friends yet"
                description="Add friends by mobile number, then invite them when you host a game."
                action={
                  <Button asChild>
                    <Link to="/host">Host a Game</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {friends.map((f) => (
                <div key={f.userId} className="surface-card flex items-center gap-3 rounded-xl p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                    {initials(f.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.name}</p>
                    {f.phone ? <p className="text-[11px] text-muted-foreground">•••• {phone10(f.phone).slice(-4)}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(f)}
                    aria-label={`Remove ${f.name}`}
                    className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {confirmRemove ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 text-center">
            <h2 className="text-xl leading-none">Remove {confirmRemove.name}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">They won't be told. You can add them again later.</p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmRemove(null)}>
                Keep
              </Button>
              <Button
                className="flex-1 bg-destructive text-destructive-foreground hover:brightness-110"
                onClick={async () => {
                  const f = confirmRemove;
                  setConfirmRemove(null);
                  try {
                    await removeFriend(f.userId);
                    toast.success(`${f.name} removed`);
                    await reload();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Couldn't remove.");
                  }
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
