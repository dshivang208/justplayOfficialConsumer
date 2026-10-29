import { useCallback, useEffect, useState } from "react";
import { Check, MessageCircle, Phone, UserPlus, Users, X } from "lucide-react";
import { Chip } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { cn } from "@/lib/utils";
import {
  contactPickerSupported,
  fetchFriendRequests,
  fetchFriends,
  matchContacts,
  phone10,
  pickDeviceContacts,
  respondFriendRequest,
  sendFriendRequest,
  type ContactMatch,
  type Friend,
  type FriendRequest,
} from "@/lib/friends";

export type InvitedPlayer = { userId: string; name: string };

type Props = {
  selected: InvitedPlayer[];
  onChange: (next: InvitedPlayer[]) => void;
  /** Max players the host can still add (spots minus the host). */
  maxInvites: number;
  /** Already invited / already in the game — shown as "Invited" and not selectable. */
  disabledIds?: string[];
  /** Text used for the WhatsApp invite to people who aren't on JustPlay yet. */
  inviteText: string;
};

const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function InvitePlayers({ selected, onChange, maxInvites, inviteText, disabledIds = [] }: Props) {
  const [tab, setTab] = useState<"friends" | "contacts">("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [contacts, setContacts] = useState<ContactMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([fetchFriends(), fetchFriendRequests()]);
      setFriends(f);
      setRequests(r);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not load friends.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const isSelected = (id: string) => selected.some((s) => s.userId === id);
  const full = selected.length >= maxInvites;
  const isDisabled = (id: string) => disabledIds.includes(id);
  const toggle = (p: InvitedPlayer) => {
    if (isDisabled(p.userId)) return;
    if (isSelected(p.userId)) onChange(selected.filter((s) => s.userId !== p.userId));
    else if (!full) onChange([...selected, p]);
    else setNote(`You can invite up to ${maxInvites} players for ${maxInvites + 1} spots.`);
  };

  const addFriendByPhone = async () => {
    if (phone10(phone).length !== 10) {
      setNote("Enter a 10-digit mobile number.");
      return;
    }
    setBusy(true);
    try {
      const r = await sendFriendRequest(phone);
      setNote(
        {
          sent: "Friend request sent. You can invite them once they accept.",
          accepted: "You're now friends!",
          already_friends: "Already in your friends list.",
          already_pending: "Request already sent — waiting for them to accept.",
          not_found: "That number isn't on JustPlay yet. Use Contacts → Invite on WhatsApp.",
          self: "That's your own number 🙂",
        }[r],
      );
      if (r === "sent" || r === "accepted") setPhone("");
      await reload();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  };

  const loadContacts = async (list: { name: string; phone10: string }[]) => {
    setBusy(true);
    try {
      const matched = await matchContacts(list);
      setContacts((prev) => {
        const m = new Map(prev.map((c) => [c.phone10, c]));
        for (const c of matched) m.set(c.phone10, c);
        return [...m.values()];
      });
      if (matched.length && !matched.some((c) => c.userId)) setNote("None of these contacts are on JustPlay yet — invite them on WhatsApp.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not check your contacts.");
    } finally {
      setBusy(false);
    }
  };

  const pickContacts = async () => {
    setNote(null);
    try {
      await loadContacts(await pickDeviceContacts());
    } catch {
      /* user closed the picker */
    }
  };

  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const addManual = async () => {
    if (phone10(manualPhone).length !== 10) {
      setNote("Enter a 10-digit mobile number.");
      return;
    }
    setNote(null);
    await loadContacts([{ name: manualName.trim() || "Contact", phone10: phone10(manualPhone) }]);
    setManualName("");
    setManualPhone("");
  };

  const whatsapp = (c: ContactMatch) =>
    `https://wa.me/91${c.phone10}?text=${encodeURIComponent(inviteText)}`;

  return (
    <div className="surface-card rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">Invite players</h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {selected.length}/{maxInvites} selected
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Optional. They get a notification and can join with one tap.
      </p>

      {selected.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selected.map((s) => (
            <span key={s.userId} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {s.name}
              <button type="button" aria-label={`Remove ${s.name}`} onClick={() => toggle(s)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <Chip active={tab === "friends"} onClick={() => setTab("friends")}>
          <Users className="mr-1 inline h-3.5 w-3.5" /> My friends
        </Chip>
        <Chip active={tab === "contacts"} onClick={() => setTab("contacts")}>
          <Phone className="mr-1 inline h-3.5 w-3.5" /> My contacts
        </Chip>
      </div>

      {note ? <p className="mt-3 rounded-xl bg-secondary p-3 text-xs font-semibold text-muted-foreground">{note}</p> : null}

      {tab === "friends" ? (
        <div className="mt-4 space-y-4">
          {requests.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Friend requests</p>
              {requests.map((r) => (
                <div key={r.requestId} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
                  <Avatar name={r.name} />
                  <span className="flex-1 truncate text-sm font-semibold">{r.name}</span>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await respondFriendRequest(r.requestId, true).catch(() => undefined);
                      await reload();
                    }}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await respondFriendRequest(r.requestId, false).catch(() => undefined);
                      await reload();
                    }}
                  >
                    Ignore
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading friends…</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">No friends yet. Add one by mobile number below.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {friends.map((f) => (
                <PersonRow
                  key={f.userId}
                  name={f.name}
                  sub={isDisabled(f.userId) ? "Invited / in game" : f.phone ? `•••• ${phone10(f.phone).slice(-4)}` : "Friend"}
                  active={isSelected(f.userId) || isDisabled(f.userId)}
                  onClick={() => toggle({ userId: f.userId, name: f.name })}
                />
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="Add friend by mobile number"
              className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <Button size="sm" onClick={addFriendByPhone} disabled={busy}>
              <UserPlus className="h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {contactPickerSupported() ? (
            <Button variant="outline" onClick={pickContacts} disabled={busy}>
              <Phone className="h-4 w-4" /> {busy ? "Checking…" : "Choose from phone contacts"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Your browser can't open the phone contact list (works in Chrome on Android). Add numbers manually:
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Name"
              className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              inputMode="tel"
              placeholder="Mobile number"
              className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-primary"
            />
            <Button size="sm" onClick={addManual} disabled={busy}>
              Check
            </Button>
          </div>

          {contacts.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {contacts.map((c) =>
                c.userId ? (
                  <PersonRow
                    key={c.phone10}
                    name={c.name}
                    sub={isDisabled(c.userId) ? "Invited / in game" : c.isFriend ? "On JustPlay · Friend" : "On JustPlay"}
                    active={isSelected(c.userId) || isDisabled(c.userId)}
                    onClick={() => toggle({ userId: c.userId!, name: c.appName || c.name })}
                  />
                ) : (
                  <div key={c.phone10} className="flex items-center gap-3 rounded-xl border border-dashed border-border p-2.5">
                    <Avatar name={c.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">Not on JustPlay</p>
                    </div>
                    <a
                      href={whatsapp(c)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Invite
                    </a>
                  </div>
                ),
              )}
            </div>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Contacts are only used to check who's on JustPlay — we don't store your address book.
          </p>
        </div>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-foreground">
      {initials(name) || "?"}
    </span>
  );
}

function PersonRow({ name, sub, active, onClick }: { name: string; sub: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border p-2.5 text-left transition-all",
        active && "border-primary bg-primary/5 ring-1 ring-primary",
      )}
    >
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      {active ? <Check className="h-4 w-4 text-primary" /> : null}
    </button>
  );
}
