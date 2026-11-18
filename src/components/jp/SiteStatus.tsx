import { useEffect, useState } from "react";
import { Megaphone, Wrench, X } from "lucide-react";
import { useSiteSettings } from "@/lib/siteSettings";

const DISMISS_KEY = "jp_announcement_dismissed";

/** Announcement bar + maintenance screen, both controlled from the admin app. */
export function SiteStatus() {
  const s = useSiteSettings();
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY));
    } catch {
      /* ignore */
    }
  }, []);

  if (s.maintenanceMode) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md">
          <span className="gradient-primary mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground">
            <Wrench className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-4xl leading-none">We'll be right back</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {s.maintenanceMessage ||
              "JustPlay is getting a quick upgrade. Please check back in a little while."}
          </p>
          {s.supportEmail ? (
            <p className="mt-5 text-xs text-muted-foreground">
              Need help? <a className="font-semibold text-primary" href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a>
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (!s.announcementActive || !s.announcementText || dismissed === s.announcementText) return null;

  const inner = (
    <>
      <Megaphone className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">{s.announcementText}</span>
    </>
  );

  return (
    <div className="relative z-[60] bg-gradient-to-r from-[#074a24] to-[#108846] px-10 py-2 text-center text-xs font-semibold text-white sm:text-sm">
      {s.announcementUrl ? (
        <a href={s.announcementUrl} className="inline-flex max-w-full items-center justify-center gap-2 hover:underline">
          {inner}
        </a>
      ) : (
        <span className="inline-flex max-w-full items-center justify-center gap-2">{inner}</span>
      )}
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          try {
            sessionStorage.setItem(DISMISS_KEY, s.announcementText ?? "");
          } catch {
            /* ignore */
          }
          setDismissed(s.announcementText);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 hover:bg-white/15"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
