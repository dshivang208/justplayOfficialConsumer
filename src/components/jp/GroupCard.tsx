import { Link } from "@tanstack/react-router";
import { Lock, MapPin, Users } from "lucide-react";
import type { Group } from "@/data/community";
import { Button } from "./Button";
import { SportTag } from "./SportTag";

export function GroupCard({
  group,
  joined,
  requested,
  onToggle,
  view = "grid",
}: {
  view?: "grid" | "list";
  group: Group;
  joined?: boolean;
  /** True if the current user has an outstanding, unapproved join request
   *  for this (private) group. */
  requested?: boolean;
  onToggle?: () => void;
}) {
  const action =
    requested && !joined ? (
      <Button size="sm" variant="surface" className="w-full sm:w-auto" disabled>
        Request Sent
      </Button>
    ) : (
      <Button
        size="sm"
        variant={joined ? "outline" : "primary"}
        className="w-full sm:w-auto"
        onClick={onToggle}
      >
        {joined ? "Leave Group" : "Join Group"}
      </Button>
    );

  if (view === "list") {
    return (
      <article className="surface-card group flex items-center gap-3 overflow-hidden rounded-2xl p-3 transition-colors hover:border-primary/60 sm:gap-4">
        <Link
          to="/groups/$groupId"
          params={{ groupId: group.id }}
          className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
        >
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-32">
            <img
              src={group.image}
              alt={`${group.name} — ${group.sport} community in Kanpur`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            {group.privacy === "Private" ? (
              <span className="absolute right-1 top-1 rounded-full bg-ink/70 p-1 text-on-image">
                <Lock className="h-3 w-3" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base leading-tight group-hover:text-primary sm:text-lg">
              {group.name}
            </h3>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Users className="h-3.5 w-3.5 text-primary" />
              {group.memberCount.toLocaleString("en-IN")} joined
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{group.area}, Kanpur</span>
            </p>
          </div>
        </Link>
        <div className="shrink-0">{action}</div>
      </article>
    );
  }

  return (
    <article className="surface-card group flex flex-col overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:border-primary/60">
      <Link to="/groups/$groupId" params={{ groupId: group.id }} className="flex flex-1 flex-col">
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={group.image}
            alt={`${group.name} — ${group.sport} community in Kanpur`}
            loading="lazy"
            width={1024}
            height={640}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute left-3 top-3">
            <SportTag sport={group.sport} />
          </span>
          {group.privacy === "Private" ? (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-ink/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-on-image">
              <Lock className="h-3 w-3" /> Private
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-3.5">
          <h3 className="text-base leading-tight group-hover:text-primary">{group.name}</h3>
          <p className="line-clamp-2 text-xs text-muted-foreground">{group.description}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Users className="h-3.5 w-3.5 text-primary" />
            {group.memberCount.toLocaleString("en-IN")} members
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {group.area}, Kanpur
          </p>
        </div>
      </Link>

      <div className="px-3.5 pb-3.5 [&>button]:w-full">{action}</div>
    </article>
  );
}