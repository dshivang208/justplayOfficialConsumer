import type { ReactNode } from "react";

/** Image hero shared by the About, Contact, Suggest and legal pages.
 *  `overlap` leaves room at the bottom so the next block can be pulled up over it. */
export function PageHero({
  image,
  imageAlt = "",
  eyebrow,
  title,
  subtitle,
  overlap = false,
  children,
}: {
  image: string;
  imageAlt?: string;
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  overlap?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <img src={image} alt={imageAlt} className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/70 via-ink/60 to-ink/85" />
      <div
        className={`mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6 md:pt-20 ${
          overlap ? "pb-24 md:pb-28" : "pb-14 md:pb-20"
        }`}
      >
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-on-image-muted">
          <span className="h-px w-6 bg-on-image-muted" /> {eyebrow}
        </span>
        <h1 className="mt-4 max-w-3xl text-5xl leading-[0.95] text-on-image sm:text-6xl">{title}</h1>
        {subtitle ? (
          <p className="mt-4 max-w-xl text-base text-on-image-muted sm:text-lg">{subtitle}</p>
        ) : null}
        {children}
      </div>
    </section>
  );
}
