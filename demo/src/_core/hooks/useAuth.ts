import { useCallback } from "react";
import { clearToken, getRole, useDataVersion } from "@/lib/api";

const ADMIN_USER = { id: 1, name: "VRG Admin", email: null as string | null, role: "admin" as const };

/**
 * Auth is a shared admin password: POST /api/login issues a signed token
 * kept in localStorage. Signed in = a valid, unexpired token.
 */
export function useAuth() {
  useDataVersion(); // re-render on sign-in/sign-out

  // The dashboard is admin-only; a member-password session doesn't open it.
  const authed = getRole() === "admin";

  const logout = useCallback(async () => {
    clearToken();
  }, []);

  return {
    user: authed ? ADMIN_USER : null,
    loading: false,
    error: null,
    isAuthenticated: authed,
    refresh: () => {},
    logout,
  };
}
