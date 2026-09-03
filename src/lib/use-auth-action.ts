import { useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "./auth";

/**
 * Wraps an action so unauthenticated users are sent to /auth first and
 * bounced back to the page they were on.
 */
export function useAuthAction() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });

  return useCallback(
    (action: () => void) => {
      if (!isAuthenticated) {
        void navigate({ to: "/auth", search: { redirect: href } });
        return false;
      }
      action();
      return true;
    },
    [isAuthenticated, navigate, href],
  );
}
