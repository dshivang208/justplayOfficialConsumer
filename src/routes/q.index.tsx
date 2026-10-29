import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { recordQrScan } from "@/lib/qrEntry";

/** Level 1 QR: opens the JustPlay website. */
export const Route = createFileRoute("/q/")({
  head: () => ({ meta: [{ title: "Opening JustPlay…" }, { name: "robots", content: "noindex" }] }),
  component: SiteQr,
});

function SiteQr() {
  const navigate = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void recordQrScan().then(() => navigate({ to: "/", replace: true }));
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      Opening JustPlay…
    </div>
  );
}
