import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, Send, Smile, Store, Trash2, Users } from "lucide-react";
import { Button } from "@/components/jp/Button";
import { useAuth } from "@/lib/auth";
import { useAuthAction } from "@/lib/use-auth-action";
import { supabase } from "@/lib/supabaseClient";
import {
  deleteMyVenueGroupMessage,
  fetchVenueGroup,
  fetchVenueGroupMessages,
  joinVenueGroup,
  leaveVenueGroup,
  sendVenueGroupMessage,
  type VenueGroup,
  type VenueGroupMessage,
} from "@/lib/venueGroup";
import { EMOJI_GROUPS } from "./chat/emojiData";

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString("en-IN", { weekday: "long" });
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * The venue's optional community group, shown on that venue's detail page
 * only. Renders NOTHING unless the venue has a live group (admin enabled the
 * facility + owner created it + not paused) — so for most venues the page is
 * exactly as it was before.
 *
 * Anyone can see the group exists and join it. The chat itself is
 * members-only (enforced by RLS, not just hidden here) and two-way: members
 * and the venue both post, unless the owner switched it to announcements-only.
 */
export function VenueGroupCard({ venueId, venueName }: { venueId: string; venueName: string }) {
  const { user } = useAuth();
  const runWithAuth = useAuthAction();
  const [group, setGroup] = useState<VenueGroup | null>(null);
  const [messages, setMessages] = useState<VenueGroupMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiGroup, setEmojiGroup] = useState(0);
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

  const loadMessages = useCallback(async () => {
    if (!groupId) return;
    setMessages(await fetchVenueGroupMessages(groupId, venueName));
  }, [groupId, venueName]);

  // Members: load the chat and stay subscribed while the page is open.
  useEffect(() => {
    if (!groupId || !isMember) {
      setMessages([]);
      return;
    }
    let active = true;
    const load = () =>
      fetchVenueGroupMessages(groupId, venueName).then((m) => {
        if (active) setMessages(m);
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
  }, [groupId, isMember, venueName]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

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

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    setEmojiOpen(false);
    try {
      await sendVenueGroupMessage(group.id, text);
      await loadMessages();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send that message.");
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const removeMine = async (id: string) => {
    try {
      await deleteMyVenueGroupMessage(id);
      await loadMessages();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete that message.");
    }
  };

  return (
    <section className="surface-card rounded-2xl p-4 sm:p-5" aria-label={`${venueName} group`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Megaphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl leading-none">{group.name}</h2>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {group.memberCount} {group.memberCount === 1 ? "member" : "members"} · group by{" "}
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
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background">
          <div ref={listRef} className="max-h-96 min-h-40 space-y-3 overflow-y-auto p-3">
            {messages.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {group.membersCanPost
                  ? "No messages yet — say hi to the group."
                  : `No updates yet — you'll see them here as soon as ${venueName} posts.`}
              </p>
            ) : (
              messages.map((m, i) => {
                const mine = m.kind === "member" && m.senderId === userId;
                const showDay =
                  i === 0 || dayKey(messages[i - 1]!.createdAt) !== dayKey(m.createdAt);
                return (
                  <div key={m.id} className="space-y-3">
                    {showDay ? (
                      <div className="flex justify-center">
                        <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {dayLabel(m.createdAt)}
                        </span>
                      </div>
                    ) : null}
                    <div className={`group flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                      {m.kind === "venue" ? (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Store className="h-4 w-4" />
                        </span>
                      ) : m.senderPhotoUrl ? (
                        <img
                          src={m.senderPhotoUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                          {initials(m.senderName)}
                        </span>
                      )}
                      <div
                        className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}
                      >
                        {!mine ? (
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                            {m.senderName}
                            {m.kind === "venue" ? (
                              <span className="rounded bg-primary/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary">
                                Venue
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                        <div
                          className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                            mine
                              ? "rounded-tr-sm bg-primary text-primary-foreground"
                              : m.kind === "venue"
                                ? "rounded-tl-sm border border-primary/30 bg-primary/5 text-foreground"
                                : "rounded-tl-sm bg-surface text-foreground"
                          }`}
                        >
                          {m.body}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {mine ? (
                            <button
                              type="button"
                              aria-label="Delete message"
                              onClick={() => void removeMine(m.id)}
                              className="opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {group.membersCanPost ? (
            <>
              {emojiOpen ? (
                <div className="border-t border-border">
                  <div className="flex gap-1 px-2 pt-1.5">
                    {EMOJI_GROUPS.map((g, i) => (
                      <button
                        key={g.label}
                        type="button"
                        title={g.label}
                        onClick={() => setEmojiGroup(i)}
                        className={`rounded-md px-2 py-1 text-base ${emojiGroup === i ? "bg-primary/10" : ""}`}
                      >
                        {g.icon}
                      </button>
                    ))}
                  </div>
                  <div className="grid max-h-36 grid-cols-8 content-start gap-0.5 overflow-y-auto p-2 text-xl">
                    {EMOJI_GROUPS[emojiGroup]!.emojis.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setDraft((d) => d + e)}
                        className="rounded-md py-1 hover:bg-muted"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex items-center gap-2 border-t border-border p-2.5">
                <button
                  type="button"
                  onClick={() => setEmojiOpen((o) => !o)}
                  aria-label="Emoji"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-muted ${
                    emojiOpen ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Smile className="h-5 w-5" />
                </button>
                <input
                  value={draft}
                  maxLength={1000}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={`Message ${group.name}…`}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!draft.trim() || sending}
                  aria-label="Send message"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </>
          ) : (
            <p className="border-t border-border px-3 py-2.5 text-center text-xs text-muted-foreground">
              Only {venueName} can post in this group.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Join to chat with {venueName} and other players, and get offers, closures and news right
          here.
        </p>
      )}
    </section>
  );
}
