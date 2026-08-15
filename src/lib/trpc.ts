import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/demo/api";
import { bump, useStoreVersion } from "@/demo/store";

/**
 * A drop-in replacement for the app's tRPC client that resolves against the
 * in-browser demo dataset instead of a server. It exposes the same surface the
 * pages use — `useQuery`, `useMutation`, `useUtils()` — so no page or component
 * needed to change to run without a backend.
 */

/** Small artificial delay so skeletons and pending states are visible. */
const LATENCY_MS = 220;

type QueryOptions = {
  enabled?: boolean;
  retry?: boolean | number;
  refetchOnWindowFocus?: boolean;
};

type MutationOptions<TOutput> = {
  onSuccess?: (data: TOutput) => void;
  onError?: (error: { message: string }) => void;
};

type QueryEndpoint<TInput, TOutput> = {
  useQuery: (
    input?: TInput,
    options?: QueryOptions
  ) => {
    data: TOutput | undefined;
    isLoading: boolean;
    error: null;
    refetch: () => Promise<{ data: TOutput }>;
  };
  /** Re-resolves every mounted instance of this query. */
  invalidate: () => Promise<void>;
  /** Present for API parity; the demo store is the single source of truth. */
  setData: (input?: TInput, value?: TOutput) => void;
};

type MutationEndpoint<TInput, TOutput> = {
  useMutation: (options?: MutationOptions<TOutput>) => {
    mutate: (input: TInput) => void;
    mutateAsync: (input: TInput) => Promise<TOutput>;
    isPending: boolean;
    error: null;
  };
};

function query<TInput, TOutput>(resolve: (input: TInput) => TOutput): QueryEndpoint<TInput, TOutput> {
  return {
    useQuery(input?: TInput, options?: QueryOptions) {
      const enabled = options?.enabled !== false;
      const version = useStoreVersion();
      const key = JSON.stringify(input ?? null);
      const [state, setState] = useState<{ data: TOutput | undefined; isLoading: boolean }>({
        data: undefined,
        isLoading: enabled,
      });

      // Keep the latest input available to refetch without re-creating it per render.
      const inputRef = useRef(input);
      inputRef.current = input;

      useEffect(() => {
        if (!enabled) {
          setState({ data: undefined, isLoading: false });
          return;
        }
        let cancelled = false;
        setState((prev) => ({ data: prev.data, isLoading: prev.data === undefined }));
        const timer = setTimeout(() => {
          if (cancelled) return;
          setState({ data: resolve(inputRef.current as TInput), isLoading: false });
        }, LATENCY_MS);
        return () => {
          cancelled = true;
          clearTimeout(timer);
        };
        // `key` covers input changes; `version` covers store mutations.
      }, [key, version, enabled]);

      const refetch = useCallback(async () => {
        const data = resolve(inputRef.current as TInput);
        setState({ data, isLoading: false });
        return { data };
      }, []);

      return { ...state, error: null, refetch };
    },
    invalidate: async () => bump(),
    setData: () => bump(),
  };
}

function mutation<TInput, TOutput>(
  run: (input: TInput) => TOutput
): MutationEndpoint<TInput, TOutput> {
  return {
    useMutation(options?: MutationOptions<TOutput>) {
      const [isPending, setIsPending] = useState(false);

      const mutateAsync = useCallback(
        (input: TInput) =>
          new Promise<TOutput>((resolve, reject) => {
            setIsPending(true);
            setTimeout(() => {
              try {
                const result = run(input);
                setIsPending(false);
                options?.onSuccess?.(result);
                resolve(result);
              } catch (err) {
                setIsPending(false);
                const message = err instanceof Error ? err.message : "Something went wrong.";
                options?.onError?.({ message });
                reject(err instanceof Error ? err : new Error(message));
              }
            }, LATENCY_MS);
          }),
        // Handlers are read at call time from the latest closure.
        [options?.onSuccess, options?.onError]
      );

      const mutate = useCallback(
        (input: TInput) => {
          void mutateAsync(input).catch(() => {
            /* surfaced through onError */
          });
        },
        [mutateAsync]
      );

      return { mutate, mutateAsync, isPending, error: null };
    },
  };
}

const router = {
  auth: {
    me: query(() => api.me()),
    logout: mutation(() => api.logout()),
    login: mutation(api.login),
    register: mutation(api.register),
    requestPasswordReset: mutation(api.requestPasswordReset),
    resetPassword: mutation(api.resetPassword),
  },
  dashboard: {
    stats: query(() => api.stats()),
    weeklyReport: query(api.weeklyReport),
    memberReport: query(api.memberReport),
    absenceSummary: query(api.absenceSummary),
  },
  goals: {
    ytdSummary: query(() => api.ytdSummary()),
    monthSummary: query(() => api.monthSummary()),
    set: mutation(api.setGoals),
  },
  members: {
    list: query(() => api.listMembers()),
    listAll: query(() => api.listAllMembers()),
    create: mutation(api.createMember),
    update: mutation(api.updateMember),
    delete: mutation(api.deleteMember),
  },
  submissions: {
    create: mutation(api.createSubmission),
  },
  users: {
    listAll: query(() => api.listAllUsers()),
    create: mutation(api.createUser),
    updateRole: mutation(api.updateUserRole),
    remove: mutation(api.removeUser),
  },
};

export const trpc = {
  ...router,
  /** Query invalidation helpers, mirroring `trpc.useUtils()` in the real app. */
  useUtils: () => router,
};
