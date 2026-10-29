import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { recordQrScan } from "@/lib/qrEntry";

/** Level 2 QR: jumps straight to one venue's page, where its slots can be booked. */
export const Route = createFileRoute("/q/$code")({
  head: () => ({ meta: [{ title: "Opening venue… | JustPlay" }, { name: "robots", content: "noindex" }] }),
  component: VenueQr,
});

function VenueQr() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void recordQrScan(code).then((venueId) => {
      if (venueId) void navigate({ to: "/venues/$venueId", params: { venueId }, replace: true });
      else void navigate({ to: "/venues", replace: true }); // unknown / paused venue: still land somewhere useful
    });
  }, [code, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" />
      Opening venue…
    </div>
  );
}
