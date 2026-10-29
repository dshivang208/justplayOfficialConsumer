import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout for the QR entry links: /q (website) and /q/<code> (one venue).
export const Route = createFileRoute("/q")({
  component: () => <Outlet />,
});
