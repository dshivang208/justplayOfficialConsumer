/**
 * The JustPlay icon — the same gradient "J" badge as the navbar logo. Used as
 * the permanent DP of venue community groups, so every venue group wears the
 * JustPlay mark regardless of the venue.
 */
export function JustPlayMark({ className = "h-10 w-10 text-xl" }: { className?: string }) {
  return (
    <span
      aria-label="JustPlay"
      className={`gradient-primary flex shrink-0 items-center justify-center rounded-full font-display text-primary-foreground ${className}`}
    >
      J
    </span>
  );
}
