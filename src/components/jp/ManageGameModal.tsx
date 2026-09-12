import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Trash2, X } from "lucide-react";
import type { Game, GameMessage, SkillLevel } from "@/data/community";
import { skillLevels } from "@/data/community";
import { fetchSlots, formatHour, type Slot } from "@/data/venues";
import { formatDateLong } from "@/lib/booking";
import { useCommunity } from "@/lib/community";
import { Button } from "./Button";
import { Chip } from "./PageShell";

/** Full host-management surface for a hosted game — opened from the
 *  "Manage" button (GameCard / game detail page). Everything here is a
 *  real Supabase write; RLS + the RPCs it calls (see
 *  20260904030000_hosted_games_manage.sql) independently re-check that the
 *  caller is actually this game's host, so this component's own
 *  `game.isMine` gate is a UI convenience, not the real access control. */
export function ManageGameModal({
  game,
  onClose,
  onRequestCancel,
}: {
  game: Game;
  onClose: () => void;
  /** Opens the existing cancel-confirmation dialog on the parent page. */
  onRequestCancel: () => void;
}) {
  const {
    approveRequest,
    rejectRequest,
    removeParticipant,
    updateGameDetails,
    fetchGameMessages,
    sendGameMessage,
  } = useCommunity();

  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // ---- Edit details ----
  const todayISO = new Date().toISOString().slice(0, 10);
  const gameStarted = game.dateISO < todayISO;
  const [editing, setEditing] = useState(false);
  const [totalSpots, setTotalSpots] = useState(String(game.spotsTotal));
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(game.skillLevel);
  const [description, setDescription] = useState(game.description);
  const [dateISO, setDateISO] = useState(game.dateISO);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedStartHour, setSelectedStartHour] = useState<number | null>(game.startHour);
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setSlotsLoading(true);
    fetchSlots(game.venueId, dateISO, game.sport)
      .then((s) => setSlots(s))
      .finally(() => setSlotsLoading(false));
  }, [editing, dateISO, game.venueId, game.sport]);

  const minSpots = Math.max(game.players.length, 1);

  const saveDetails = async () => {
    const spotsNum = Number(totalSpots);
    if (!Number.isFinite(spotsNum) || spotsNum < minSpots) {
      toast.error(`Total spots can't be less than the ${minSpots} player(s) already in this game.`);
      return;
    }
    if (!gameStarted && dateISO !== game.dateISO && selectedStartHour === null) {
      toast.error("Pick an available slot for the new date first.");
      return;
    }
    setSavingDetails(true);
    try {
      await updateGameDetails(game.id, {
        spotsTotal: spotsNum,
        skillLevel,
        description,
        ...(gameStarted
          ? {}
          : {
              dateISO,
              startHour: selectedStartHour ?? game.startHour,
              endHour: (selectedStartHour ?? game.startHour) + 1,
            }),
      });
      toast.success("Game details updated");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save changes. Try again.");
    } finally {
      setSavingDetails(false);
    }
  };

  // ---- Pending requests ----
  const handleApprove = async (userId: string) => {
    setBusyId(userId);
    try {
      await approveRequest(game.id, userId);
      toast.success("Request approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't approve this request.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (userId: string) => {
    setBusyId(userId);
    try {
      await rejectRequest(game.id, userId);
      toast.success("Request rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reject this request.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setBusyId(removeTarget.id);
    try {
      await removeParticipant(game.id, removeTarget.id);
      toast.success(`${removeTarget.name} removed from the game`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove this player.");
    } finally {
      setBusyId(null);
      setRemoveTarget(null);
    }
  };

  // ---- Messaging ----
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchGameMessages(game.id)
      .then(setMessages)
      .catch(() => {})
      .finally(() => setMessagesLoading(false));
  }, [fetchGameMessages, game.id]);

  const send = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const msg = await sendGameMessage(game.id, draft.trim());
      setMessages((prev) => [...prev, msg]);
      setDraft("");
      toast.success("Message sent to all joined players");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send this message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-background p-5 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl leading-none">Manage Game</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {game.venueName} · {formatDateLong(game.dateISO)}
        </p>

        {/* Pending requests */}
        {game.joinPolicy === "approval" && game.pendingRequests.length > 0 ? (
          <section className="mt-5">
            <h3 className="text-sm font-bold text-foreground">
              Pending Requests ({game.pendingRequests.length})
            </h3>
            <div className="mt-2 space-y-2">
              {game.pendingRequests.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[11px] font-bold">
                      {p.initials}
                    </span>
                    <span className="text-sm font-semibold">{p.name}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={busyId === p.id}
                      onClick={() => handleReject(p.id)}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      disabled={busyId === p.id}
                      onClick={() => handleApprove(p.id)}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Participant list */}
        <section className="mt-5">
          <h3 className="text-sm font-bold text-foreground">Players ({game.players.length})</h3>
          <div className="mt-2 space-y-2">
            {game.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface p-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[11px] font-bold">
                    {p.initials}
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">
                      {p.id === game.hostId ? `${p.name} (Host)` : p.name}
                    </p>
                    {p.joinedAt ? (
                      <p className="text-[11px] text-muted-foreground">
                        Joined{" "}
                        {new Date(p.joinedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    ) : null}
                  </div>
                </div>
                {p.id !== game.hostId ? (
                  <button
                    onClick={() => setRemoveTarget({ id: p.id, name: p.name })}
                    disabled={busyId === p.id}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove ${p.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* Edit game details */}
        <section className="mt-5 rounded-xl border border-border p-3.5">
          <button
            onClick={() => setEditing((v) => !v)}
            className="flex w-full items-center justify-between text-sm font-bold text-foreground"
          >
            Edit Game Details
            <span className="text-xs font-semibold text-primary">{editing ? "Close" : "Edit"}</span>
          </button>

          {editing ? (
            <div className="mt-4 space-y-4">
              {gameStarted ? (
                <p className="rounded-lg bg-secondary p-2.5 text-xs text-muted-foreground">
                  This game's date has already passed, so date/time can't be changed — you can still
                  update spots, skill level, and description below.
                </p>
              ) : (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Date</label>
                  <input
                    type="date"
                    min={todayISO}
                    value={dateISO}
                    onChange={(e) => {
                      setDateISO(e.target.value);
                      setSelectedStartHour(null);
                    }}
                    className="mt-1.5 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                  />
                  <p className="mt-2 text-xs font-semibold text-muted-foreground">
                    Available slots at {game.venueName}
                  </p>
                  {slotsLoading ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">Checking availability…</p>
                  ) : slots.filter((s) => s.status === "available").length === 0 ? (
                    <p className="mt-1.5 text-xs text-destructive">
                      No open slots for this date — pick a different date.
                    </p>
                  ) : (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {slots.map((s) => (
                        <Chip
                          key={s.id}
                          active={selectedStartHour === s.startHour}
                          onClick={() =>
                            s.status === "available" && setSelectedStartHour(s.startHour)
                          }
                        >
                          {formatHour(s.startHour)}
                          {s.status !== "available" ? " · booked" : ""}
                        </Chip>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Total spots (min {minSpots} — players already joined)
                </label>
                <input
                  type="number"
                  min={minSpots}
                  value={totalSpots}
                  onChange={(e) => setTotalSpots(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Skill level</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {skillLevels.map((s) => (
                    <Chip key={s} active={skillLevel === s} onClick={() => setSkillLevel(s)}>
                      {s}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1.5 w-full rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-primary"
                />
              </div>

              <Button className="w-full" disabled={savingDetails} onClick={saveDetails}>
                {savingDetails ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : null}
        </section>

        {/* Message players */}
        <section className="mt-5">
          <h3 className="text-sm font-bold text-foreground">Message joined players</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Sent to all {game.players.length} player(s) currently in this game.
          </p>

          {messagesLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">Loading messages…</p>
          ) : messages.length > 0 ? (
            <div className="mt-2 max-h-36 space-y-2 overflow-y-auto rounded-xl bg-secondary p-2.5">
              {messages.map((m) => (
                <div key={m.id} className="text-xs">
                  <span className="font-semibold text-foreground">{m.senderName}: </span>
                  <span className="text-muted-foreground">{m.message}</span>
                </div>
              ))}
            </div>
          ) : null}

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Reminder: bring your own racket…"
            className="mt-3 w-full rounded-xl border border-border bg-surface p-3 text-sm outline-none focus:border-primary"
          />
          <Button className="mt-2 w-full" disabled={!draft.trim() || sending} onClick={send}>
            {sending ? "Sending…" : "Send message"}
          </Button>
        </section>

        {/* Danger zone */}
        <section className="mt-5 border-t border-border pt-4">
          <Button
            variant="ghost"
            className="w-full text-destructive hover:bg-destructive/10"
            onClick={onRequestCancel}
          >
            Cancel this game
          </Button>
        </section>
      </div>

      {removeTarget ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 text-center">
            <h2 className="text-xl leading-none">Remove {removeTarget.name}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              They'll be taken off this game's roster and their spot freed up.
            </p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRemoveTarget(null)}>
                Keep them
              </Button>
              <Button
                className="flex-1 bg-destructive text-destructive-foreground hover:brightness-110"
                onClick={handleRemove}
              >
                <Check className="h-4 w-4" /> Remove
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}