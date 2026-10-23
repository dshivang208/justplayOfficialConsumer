import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, PageHeader } from "@/components/jp/PageShell";
import { Button } from "@/components/jp/Button";
import { NotificationPanel } from "@/components/jp/NotificationPanel";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [{ title: "Notifications | JustPlay" }, { name: "robots", content: "noindex" }],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { isAuthenticated, hydrated } = useAuth();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Stay in the loop"
        title="Notifications"
        subtitle="Booking updates, replies from support, rewards and offers — all in one place."
      />
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        {!hydrated ? null : !isAuthenticated ? (
          <div className="surface-card rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">Sign in to see your notifications.</p>
            <Button asChild className="mt-4">
              <Link to="/auth" search={{ redirect: "/notifications" }}>
                Sign in
              </Link>
            </Button>
          </div>
        ) : (
          <div className="surface-card overflow-hidden rounded-2xl">
            <NotificationPanel fullPage />
          </div>
        )}
      </div>
    </PageShell>
  );
}
