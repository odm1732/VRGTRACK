import { useCallback } from "react";
import { clearToken, getAdminName, getSession, useDataVersion } from "@/lib/api";



/**
 * Auth is a shared admin password: POST /api/login issues a signed token
 * kept in localStorage. Signed in = a valid, unexpired token.
 */
export function useAuth() {
  useDataVersion(); // re-render on sign-in/sign-out

  // The dashboard is admin-only; a member-password session doesn't open it.
  const authed = getSession()?.role === "admin";

  const logout = useCallback(async () => {
    clearToken();
  }, []);

  return {
    user: authed
      ? { id: 1, name: getAdminName(), email: null as string | null, role: "admin" as const }
      : null,
    loading: false,
    error: null,
    isAuthenticated: authed,
    refresh: () => {},
    logout,
  };
}
