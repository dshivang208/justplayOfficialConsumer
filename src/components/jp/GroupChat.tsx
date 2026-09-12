import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import type { GroupMessage } from "@/data/community";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";

/** Real-time group chat — members-only (RLS on group_messages), sender
 *  identity here is only ever a display name + avatar (from
 *  public_profiles, which has no phone column at all — see the
 *  migration's comments). Subscribes to postgres_changes for this
 *  specific group and cleans the channel up on unmount/group change so no
 *  subscription lingers after navigating away. */
export function GroupChat({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const { fetchGroupMessages, sendGroupMessage } = useCommunity();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchGroupMessages(groupId)
      .then((msgs) => {
        if (active) setMessages(msgs);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          void fetchGroupMessages(groupId).then((msgs) => {
            if (active) setMessages(msgs);
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [groupId, fetchGroupMessages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setSending(true);
    setDraft("");
    try {
      const msg = await sendGroupMessage(groupId, text);
      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that message.");
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[28rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-xs text-muted-foreground">Loading chat…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            No messages yet — say hi to the group.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === user?.id;
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {m.senderPhotoUrl ? (
                  <img
                    src={m.senderPhotoUrl}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {m.senderName
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                )}
                <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  {!mine ? (
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {m.senderName}
                    </span>
                  ) : null}
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm ${
                      mine
                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-tl-sm bg-background text-foreground"
                    }`}
                  >
                    {m.message}
                  </div>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Message the group…"
          className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}