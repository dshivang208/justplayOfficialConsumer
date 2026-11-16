import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

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
    <section className="surface-card mt-4 rounded-2xl p-5 first:mt-0 sm:p-6">
      <div className="flex items-start gap-3.5">
        <span className="gradient-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-primary-foreground">
          {number}
        </span>
        <h2 className="pt-0.5 text-xl leading-tight sm:text-2xl">{title}</h2>
      </div>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground sm:pl-[3.125rem] sm:text-[15px]">
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

/** Cross-links shown at the bottom of every legal page. */
export function LegalFooterLinks({ current }: { current: "privacy" | "terms" }) {
  const links = [
    { to: "/privacy", label: "Privacy Policy", id: "privacy" },
    { to: "/terms", label: "Terms & Conditions", id: "terms" },
    { to: "/contact", label: "Contact us", id: "contact" },
  ] as const;
  return (
    <div className="mt-10 flex flex-wrap gap-2.5 border-t border-border pt-6">
      {links
        .filter((l) => l.id !== current)
        .map((l) => (
          <Link
            key={l.id}
            to={l.to}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {l.label}
          </Link>
        ))}
    </div>
  );
}
