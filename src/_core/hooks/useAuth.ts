import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Demo counterpart of the app's `useAuth`. Same return shape, but the session
 * lives in the browser demo store instead of a signed cookie.
 */
export function useAuth() {
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync(undefined);
    await utils.auth.me.invalidate();
  }, [logoutMutation, utils]);

  const state = useMemo(
    () => ({
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: null,
      isAuthenticated: Boolean(meQuery.data),
    }),
    [meQuery.data, meQuery.isLoading, logoutMutation.isPending]
  );

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
