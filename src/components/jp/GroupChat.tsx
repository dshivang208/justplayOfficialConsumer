import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Paperclip, Send, Smile, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchChatMessages,
  gifSearchAvailable,
  searchGifs,
  sendAttachment,
  sendGif,
  sendSticker,
  sendText,
  validateAttachment,
  type ChatMessage,
  type GifResult,
} from "@/lib/groupChat";
import { EMOJI_GROUPS, STICKERS } from "./chat/emojiData";

/** Local-calendar-day key, so messages group by the viewer's own date. */
function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** WhatsApp-style day label: Today / Yesterday / weekday (this week) / date. */
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

type PickerTab = "emoji" | "stickers" | "gifs";

function GifPanel({ onPick }: { onPick: (g: GifResult) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gifSearchAvailable) return;
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchGifs(query)
        .then((r) => active && setResults(r))
        .catch((e: Error) => active && toast.error(e.message))
        .finally(() => active && setLoading(false));
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  if (!gifSearchAvailable) {
    return (
      <p className="p-4 text-center text-xs text-muted-foreground">
        GIF search isn't set up yet. You can still attach a .gif file with the paperclip.
      </p>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search GIFs…"
        className="m-2 h-8 rounded-lg border border-border bg-background px-2.5 text-xs outline-none focus:border-primary"
      />
      <div className="grid flex-1 grid-cols-3 gap-1.5 overflow-y-auto px-2 pb-2">
        {loading && results.length === 0 ? (
          <p className="col-span-3 py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : (
          results.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onPick(g)}
              className="overflow-hidden rounded-lg"
            >
              <img
                src={g.previewUrl}
                alt="GIF"
                loading="lazy"
                className="h-20 w-full object-cover"
              />
            </button>
          ))
        )}
      </div>
      <p className="px-2 pb-1 text-right text-[9px] text-muted-foreground">Powered by GIPHY</p>
    </div>
  );
}

function PickerPanel({
  tab,
  onTab,
  onEmoji,
  onSticker,
  onGif,
}: {
  tab: PickerTab;
  onTab: (t: PickerTab) => void;
  onEmoji: (e: string) => void;
  onSticker: (e: string) => void;
  onGif: (g: GifResult) => void;
}) {
  const [group, setGroup] = useState(0);
  return (
    <div className="flex h-64 flex-col border-t border-border bg-background">
      <div className="flex border-b border-border text-xs font-semibold">
        {(
          [
            ["emoji", "Emoji"],
            ["stickers", "Stickers"],
            ["gifs", "GIF"],
          ] as [PickerTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onTab(id)}
            className={`flex-1 py-2 ${tab === id ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "emoji" ? (
          <div className="flex h-full flex-col">
            <div className="flex gap-1 px-2 pt-1.5">
              {EMOJI_GROUPS.map((g, i) => (
                <button
                  key={g.label}
                  type="button"
                  title={g.label}
                  onClick={() => setGroup(i)}
                  className={`rounded-md px-2 py-1 text-base ${group === i ? "bg-primary/10" : ""}`}
                >
                  {g.icon}
                </button>
              ))}
            </div>
            <div className="grid flex-1 grid-cols-8 content-start gap-0.5 overflow-y-auto p-2 text-xl">
              {EMOJI_GROUPS[group]!.emojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onEmoji(e)}
                  className="rounded-md py-1 hover:bg-muted"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ) : tab === "stickers" ? (
          <div className="grid h-full grid-cols-4 content-start gap-1 overflow-y-auto p-2 text-4xl">
            {STICKERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSticker(s)}
                className="rounded-lg py-1.5 hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <GifPanel onPick={onGif} />
        )}
      </div>
    </div>
  );
}

function MessageBody({ m, mine }: { m: ChatMessage; mine: boolean }) {
  if (m.type === "sticker") {
    return <div className="text-6xl leading-none">{m.text}</div>;
  }
  const bubble = `rounded-2xl text-sm ${
    mine
      ? "rounded-tr-sm bg-primary text-primary-foreground"
      : "rounded-tl-sm bg-background text-foreground"
  }`;
  if (m.type === "text") {
    return <div className={`${bubble} whitespace-pre-wrap break-words px-3.5 py-2`}>{m.text}</div>;
  }
  return (
    <div className={`${bubble} overflow-hidden p-1`}>
      {m.mediaSrc ? (
        m.type === "video" ? (
          <video
            src={m.mediaSrc}
            controls
            preload="metadata"
            playsInline
            className="max-h-64 w-full rounded-xl bg-black"
          />
        ) : (
          <a href={m.mediaSrc} target="_blank" rel="noreferrer">
            <img
              src={m.mediaSrc}
              alt={m.type === "gif" ? "GIF" : "Photo"}
              loading="lazy"
              className="max-h-64 w-full rounded-xl object-cover"
            />
          </a>
        )
      ) : (
        <div className="flex h-24 items-center justify-center text-xs opacity-70">
          Media unavailable
        </div>
      )}
      {m.text ? <p className="whitespace-pre-wrap break-words px-2.5 py-1.5">{m.text}</p> : null}
    </div>
  );
}

/** Real-time group chat — members-only (RLS on group_messages). Supports
 *  text, photos, videos, GIFs, stickers and emoji. Subscribes to
 *  postgres_changes for this group and cleans the channel up on unmount. */
export function GroupChat({ groupId }: { groupId: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [picker, setPicker] = useState<PickerTab | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => (previewUrl ? URL.revokeObjectURL(previewUrl) : undefined), [previewUrl]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchChatMessages(groupId)
      .then((msgs) => active && setMessages(msgs))
      .catch(() => {})
      .finally(() => active && setLoading(false));

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
          void fetchChatMessages(groupId)
            .then((msgs) => active && setMessages(msgs))
            .catch(() => {});
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [groupId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const refresh = async () => setMessages(await fetchChatMessages(groupId));

  const run = async (job: () => Promise<void>, onFail?: () => void) => {
    setSending(true);
    try {
      await job();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that message.");
      onFail?.();
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (file) {
      const f = file;
      setFile(null);
      setDraft("");
      setPicker(null);
      await run(
        () => sendAttachment(groupId, f, text),
        () => {
          setFile(f);
          setDraft(text);
        },
      );
      return;
    }
    if (!text) return;
    setDraft("");
    setPicker(null);
    await run(
      () => sendText(groupId, text),
      () => setDraft(text),
    );
  };

  const onPickFile = (f: File | undefined) => {
    if (!f) return;
    const problem = validateAttachment(f);
    if (problem) {
      toast.error(problem);
      return;
    }
    setFile(f);
    setPicker(null);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <div ref={listRef} className="h-[28rem] flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <p className="text-center text-xs text-muted-foreground">Loading chat…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            No messages yet — say hi to the group.
          </p>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderId === user?.id;
            const showDay = i === 0 || dayKey(messages[i - 1]!.createdAt) !== dayKey(m.createdAt);
            return (
              <div key={m.id} className="space-y-3">
                {showDay ? (
                  <div className="flex justify-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {dayLabel(m.createdAt)}
                    </span>
                  </div>
                ) : null}
                <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
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
                  <div
                    className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}
                  >
                    {!mine ? (
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {m.senderName}
                      </span>
                    ) : null}
                    <MessageBody m={m} mine={mine} />
                    <span className="mt-0.5 text-[10px] text-muted-foreground">
                      {new Date(m.createdAt).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {file && previewUrl ? (
        <div className="flex items-center gap-3 border-t border-border bg-background px-3 py-2">
          {file.type.startsWith("video/") ? (
            <video src={previewUrl} className="h-14 w-14 rounded-lg object-cover" muted />
          ) : (
            <img src={previewUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-semibold">{file.name}</p>
            <p className="text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(1)} MB · add a caption below
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="Remove attachment"
            className="p-1 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {picker ? (
        <PickerPanel
          tab={picker}
          onTab={setPicker}
          onEmoji={(e) => setDraft((d) => d + e)}
          onSticker={(s) => {
            setPicker(null);
            void run(() => sendSticker(groupId, s));
          }}
          onGif={(g) => {
            setPicker(null);
            void run(() => sendGif(groupId, g.url));
          }}
        />
      ) : null}

      <div className="flex items-center gap-2 border-t border-border p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => {
            onPickFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={sending}
          aria-label="Attach photo or video"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setPicker((p) => (p ? null : "emoji"))}
          aria-label="Emoji, stickers and GIFs"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-muted ${picker ? "text-primary" : "text-muted-foreground"}`}
        >
          <Smile className="h-5 w-5" />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={file ? "Add a caption…" : "Message the group…"}
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={send}
          disabled={(!draft.trim() && !file) || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
          aria-label="Send message"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
