import { formatHour } from "@/data/venues";
import type { Game } from "@/data/community";

export function gameTimeLabel(game: Pick<Game, "startHour" | "endHour">) {
  return `${formatHour(game.startHour)} – ${formatHour(game.endHour)}`;
}

/** "Tonight" / "Tomorrow" / "Sat, 29 Aug" */
export function relativeDayLabel(dateISO: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateISO}T00:00:00`);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return target.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function daysUntil(dateISO: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateISO}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
