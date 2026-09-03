import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Skeleton used while data-driven sections load (API swap in later phases). */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("surface-card animate-pulse overflow-hidden rounded-2xl", className)}>
      <div className="aspect-[4/3] w-full bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="h-3 w-1/3 rounded bg-muted" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center rounded-2xl px-6 py-14 text-center">
      {icon ? <div className="mb-4 text-primary">{icon}</div> : null}
      <h3 className="text-2xl">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
