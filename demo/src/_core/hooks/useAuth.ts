import { useCallback } from "react";
import { clearToken, isAuthed, useDataVersion } from "@/lib/api";

const ADMIN_USER = { id: 1, name: "VRG Admin", email: null as string | null, role: "admin" as const };

/**
 * Auth is a shared admin password: POST /api/login issues a signed token
 * kept in localStorage. Signed in = a valid, unexpired token.
 */
export function useAuth() {
  useDataVersion(); // re-render on sign-in/sign-out

  const authed = isAuthed();

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
