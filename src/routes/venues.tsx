import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/venues")({
  component: () => <Outlet />,
});
