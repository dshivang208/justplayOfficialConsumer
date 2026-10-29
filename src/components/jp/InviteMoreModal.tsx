import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "./Button";
import { InvitePlayers, type InvitedPlayer } from "./InvitePlayers";
import { fetchInvitedIds, invitePlayers } from "@/lib/friends";
import type { Game } from "@/data/community";
import { formatDateLong } from "@/lib/booking";
import { gameTimeLabel } from "@/lib/games";

/** Host-only: invite more players (friends / contacts) AFTER the game is published. */
export function InviteMoreModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const [selected, setSelected] = useState<InvitedPlayer[]>([]);
  const [already, setAlready] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchInvitedIds(game.id).then((ids) => active && setAlready(ids));
    return () => {
      active = false;
    };
  }, [game.id]);

  const disabledIds = [...new Set([...already, ...game.players.map((p) => p.id)])];
  const spotsLeft = Math.max(game.spotsTotal - game.players.length, 0);

  const send = async () => {
    setBusy(true);
    try {
      const n = await invitePlayers(game.id, selected.map((p) => p.userId));
      toast.success(n > 0 ? `Invite sent to ${n} player${n > 1 ? "s" : ""}` : "They were already invited");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send invites. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-border bg-background sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Invite players"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-xl leading-tight">Invite players</h2>
            <p className="text-xs text-muted-foreground">
              {game.sport} · {formatDateLong(game.dateISO)} · {gameTimeLabel(game)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-3 sm:p-4">
          <InvitePlayers
            selected={selected}
            onChange={setSelected}
            maxInvites={30}
            disabledIds={disabledIds}
            inviteText={`Join my ${game.sport} game at ${game.venueName} on ${formatDateLong(game.dateISO)}, ${gameTimeLabel(game)}. ${window.location.origin}/games/${game.id}`}
          />
          {spotsLeft === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              The game is full right now — invited players will be put on the waiting list if they join.
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <span className="text-xs text-muted-foreground">{selected.length} selected</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={send} disabled={busy || selected.length === 0}>
              {busy ? "Sending…" : `Send invite${selected.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
