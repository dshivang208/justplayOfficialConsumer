import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { savePendingReferralCode } from "@/lib/referralProgram";

/**
 * Landing target for shared referral links (/r/JPXXXXXX): remember the code,
 * then send the visitor to sign up. ReferralCapture applies it once they're in.
 */
export const Route = createFileRoute("/r/$code")({
  head: () => ({
    meta: [
      { title: "You've been invited to JustPlay" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReferralLanding,
});

function ReferralLanding() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { hydrated, isAuthenticated } = useAuth();

  useEffect(() => {
    savePendingReferralCode(code);
  }, [code]);

  useEffect(() => {
    if (!hydrated) return;
    void navigate({ to: isAuthenticated ? "/invite" : "/auth", replace: true });
  }, [hydrated, isAuthenticated, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
