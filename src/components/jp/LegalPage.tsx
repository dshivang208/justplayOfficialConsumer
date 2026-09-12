import type { ReactNode } from "react";

/** One numbered section of a legal page (Privacy Policy / Terms &
 *  Conditions) — consistent heading, spacing and prose styling so both
 *  pages read as one system instead of a plain text dump. */
export function LegalSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-2xl leading-none">
        <span className="mr-2 text-primary">{number}.</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}

/** Placeholder-legal-content banner, shown at the top of both legal pages. */
export function LegalPlaceholderNotice() {
  return (
    <div className="surface-card rounded-2xl border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">Note: </span>
      This page is placeholder content prepared to be structurally complete and India-appropriate,
      but it has not yet been reviewed by a lawyer. It will be finalized before JustPlay is
      generally available.
    </div>
  );
}