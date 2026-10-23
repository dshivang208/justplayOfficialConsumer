import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Loader2,
  Paperclip,
  Send,
  Smile,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import {
  classifyAttachment,
  deleteMyVenueGroupMessage,
  fetchVenueGroupMessages,
  formatFileSize,
  sendVenueGroupAttachment,
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

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

function Attachment({ m, mine }: { m: VenueGroupMessage; mine: boolean }) {
  if (m.type === "text") return null;
  if (!m.mediaSrc) {
    return <p className="text-xs italic opacity-70">Attachment unavailable</p>;
  }
  if (m.type === "image") {
    return (
      <a href={m.mediaSrc} target="_blank" rel="noreferrer">
        <img
          src={m.mediaSrc}
          alt={m.fileName ?? "Photo"}
          loading="lazy"
          className="mb-1 max-h-72 w-full rounded-xl object-cover"
        />
      </a>
    );
  }
  if (m.type === "video") {
    return (
      <video
        src={m.mediaSrc}
        controls
        preload="metadata"
        className="mb-1 max-h-72 w-full rounded-xl bg-black"
      />
    );
  }
  return (
    <a
      href={m.mediaSrc}
      target="_blank"
      rel="noreferrer"
      download={m.fileName ?? undefined}
      className={`mb-1 flex items-center gap-3 rounded-xl border p-2.5 ${
        mine ? "border-primary-foreground/30" : "border-border bg-background"
      }`}
    >
      <FileText className="h-8 w-8 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{m.fileName ?? "File"}</span>
        <span className="block text-[11px] opacity-70">{formatFileSize(m.fileSize)}</span>
      </span>
      <Download className="h-4 w-4 shrink-0" />
    </a>
  );
}

/**
 * The two-way chat of a venue community group (members + the venue), with
 * photo / video / file attachments. Rendered on the dedicated group page.
 */
export function VenueGroupChat({
  group,
  venueName,
}: {
  group: VenueGroup;
  venueName: string;
}) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const groupId = group.id;
  const [messages, setMessages] = useState<VenueGroupMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiGroup, setEmojiGroup] = useState(0);
  const [pending, setPending] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setMessages(await fetchVenueGroupMessages(groupId, venueName));
  }, [groupId, venueName]);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      fetchVenueGroupMessages(groupId, venueName).then((m) => {
        if (active) setMessages(m);
      });
    void refresh();
    const channel = supabase
      .channel(`venue-group-page-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "venue_group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [groupId, venueName]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  useEffect(() => {
    if (pending && pending.type.startsWith("image/")) {
      const url = URL.createObjectURL(pending);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
    return undefined;
  }, [pending]);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    try {
      classifyAttachment(file);
      setPending(file);
      setEmojiOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Can't attach that file.");
    }
  };

  const send = async () => {
    const text = draft.trim();
    if ((!text && !pending) || sending) return;
    setSending(true);
    const file = pending;
    setDraft("");
    setPending(null);
    setEmojiOpen(false);
    try {
      if (file) await sendVenueGroupAttachment(groupId, file, text);
      else await sendVenueGroupMessage(groupId, text);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send that message.");
      setDraft(text);
      setPending(file);
    } finally {
      setSending(false);
    }
  };

  const removeMine = async (id: string) => {
    try {
      await deleteMyVenueGroupMessage(id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete that message.");
    }
  };

  return (
    <div className="flex h-[calc(100dvh-16rem)] min-h-[26rem] flex-col overflow-hidden rounded-2xl border border-border bg-background">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {group.membersCanPost
              ? "No messages yet — say hi to the group."
              : `No updates yet — you'll see them here as soon as ${venueName} posts.`}
          </p>
        ) : (
          messages.map((m, i) => {
            const mine = m.kind === "member" && m.senderId === userId;
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
                    className={`flex max-w-[80%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}
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
                      className={`w-full break-words rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "rounded-tr-sm bg-primary text-primary-foreground"
                          : m.kind === "venue"
                            ? "rounded-tl-sm border border-primary/30 bg-primary/5 text-foreground"
                            : "rounded-tl-sm bg-surface text-foreground"
                      }`}
                    >
                      <Attachment m={m} mine={mine} />
                      {m.body ? <p className="whitespace-pre-wrap px-0.5">{m.body}</p> : null}
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
          {pending ? (
            <div className="flex items-center gap-3 border-t border-border bg-surface px-3 py-2">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <FileText className="h-10 w-10 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{pending.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatFileSize(pending.size)}</p>
              </div>
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() => setPending(null)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
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
          <div className="flex items-center gap-1.5 border-t border-border p-2.5">
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach photo, video or file"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
            >
              <Paperclip className="h-5 w-5" />
            </button>
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
              placeholder={pending ? "Add a caption…" : `Message ${group.name}…`}
              className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={(!draft.trim() && !pending) || sending}
              aria-label="Send message"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </>
      ) : (
        <p className="border-t border-border px-3 py-2.5 text-center text-xs text-muted-foreground">
          Only {venueName} can post in this group.
        </p>
      )}
    </div>
  );
}
