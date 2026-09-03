import { Link } from "@tanstack/react-router";
import { Lock, Users } from "lucide-react";
import type { Group } from "@/data/community";
import { Button } from "./Button";
import { SportTag } from "./SportTag";

export function GroupCard({
  group,
  joined,
  onToggle,
}: {
  group: Group;
  joined?: boolean;
  onToggle?: () => void;
}) {
  return (
    <article className="surface-card group flex flex-col overflow-hidden rounded-2xl transition-all hover:-translate-y-1 hover:border-primary/60">
      <Link
        to="/groups/$groupId"
        params={{ groupId: group.id }}
        className="relative block aspect-[16/10] overflow-hidden"
      >
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
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <h3 className="text-base leading-tight">
          <Link to="/groups/$groupId" params={{ groupId: group.id }} className="hover:text-primary">
            {group.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">{group.description}</p>
        <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Users className="h-3.5 w-3.5 text-primary" />
          {group.memberCount.toLocaleString("en-IN")} members
        </p>
        <div className="mt-auto pt-3">
          <Button
            size="sm"
            variant={joined ? "outline" : "primary"}
            className="w-full"
            onClick={onToggle}
          >
            {joined ? "Leave Group" : "Join Group"}
          </Button>
        </div>
      </div>
    </article>
  );
}
