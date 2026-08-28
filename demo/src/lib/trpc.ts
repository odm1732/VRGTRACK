import { useCallback, useRef, useState } from "react";
import { useEffect } from "react";
import {
  api,
  bump,
  clearToken,
  isAuthed,
  reviveMember,
  reviveSubmission,
  setToken,
  useDataVersion,
  type Member,
  type ParsedSubmission,
  type AgendaDoc,
  type NoteDoc,
  type RawNoteRow,
  type RawTypes,
} from "@/lib/api";

/**
 * tRPC-shaped data layer over the real API, so the pages (written against
 * the original app's tRPC client) run unchanged. Queries re-run whenever a
 * mutation succeeds or auth changes.
 */

type QueryOptions = {
  enabled?: boolean;
  retry?: boolean | number;
  refetchOnWindowFocus?: boolean;
};

type MutationOptions<TOutput> = {
  onSuccess?: (data: TOutput) => void;
  onError?: (error: { message: string }) => void;
};

function query<TInput, TOutput>(resolve: (input: TInput) => Promise<TOutput>) {
  return {
    useQuery(input?: TInput, options?: QueryOptions) {
      const enabled = options?.enabled !== false;
      const version = useDataVersion();
      const key = JSON.stringify(input ?? null);
      const [state, setState] = useState<{ key: string; data: TOutput | undefined; isLoading: boolean }>({
        key,
        data: undefined,
        isLoading: enabled,
      });
      const inputRef = useRef(input);
      inputRef.current = input;

      // Render-time reset: the moment the input key changes, the previous
      // data is discarded in the SAME render, so no consumer ever observes
      // rows that belong to a different input (e.g. last week's notes while
      // this week's are still loading).
      if (state.key !== key) {
        setState({ key, data: undefined, isLoading: enabled });
      }

      useEffect(() => {
        if (!enabled) {
          setState({ key, data: undefined, isLoading: false });
          return;
        }
        let cancelled = false;
        setState((prev) => ({ key, data: prev.key === key ? prev.data : undefined, isLoading: prev.key !== key || prev.data === undefined }));
        resolve(inputRef.current as TInput)
          .then((data) => {
            if (!cancelled) setState({ key, data, isLoading: false });
          })
          .catch(() => {
            if (!cancelled) setState((prev) => ({ ...prev, isLoading: false }));
          });
        return () => {
          cancelled = true;
        };
      }, [key, version, enabled]);

      const refetch = useCallback(async () => {
        const data = await resolve(inputRef.current as TInput);
        setState({ key: JSON.stringify(inputRef.current ?? null), data, isLoading: false });
        return { data };
      }, []);

      return { data: state.data, isLoading: state.isLoading, error: null, refetch };
    },
    invalidate: async () => bump(),
    setData: () => bump(),
  };
}

function mutation<TInput, TOutput>(run: (input: TInput) => Promise<TOutput>) {
  return {
    useMutation(options?: MutationOptions<TOutput>) {
      const [isPending, setIsPending] = useState(false);
      const optsRef = useRef(options);
      optsRef.current = options;

      const mutateAsync = useCallback(async (input: TInput) => {
        setIsPending(true);
        try {
          const result = await run(input);
          setIsPending(false);
          bump(); // refresh every live query after a successful write
          optsRef.current?.onSuccess?.(result);
          return result;
        } catch (e) {
          setIsPending(false);
          const message = e instanceof Error ? e.message : "Something went wrong.";
          optsRef.current?.onError?.({ message });
          throw e instanceof Error ? e : new Error(message);
        }
      }, []);

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

// ─── Shared fetch helpers ─────────────────────────────────────────────────────

type RawMember = RawTypes["member"];
type RawSubmission = RawTypes["submission"];

type SummaryPayload = {
  year: number;
  monthName: string;
  ytd: { referrals: number; oneToOnes: number; money: number; visitors: number };
  month: { referrals: number; oneToOnes: number; money: number; visitors: number };
  goals: { year: number; referrals: number; oneToOnes: number; money: number; visitors: number } | null;
};

const fetchSummary = () => api<SummaryPayload>("summary");

async function fetchReport(fromDate: Date, toDate: Date) {
  const q = `from=${encodeURIComponent(fromDate.toISOString())}&to=${encodeURIComponent(toDate.toISOString())}`;
  const r = await api<{ submissions: RawSubmission[]; members: RawMember[] }>(`admin/report?${q}`);
  return {
    submissions: r.submissions.map(reviveSubmission),
    members: r.members.map(reviveMember),
  };
}

const ADMIN_USER = { id: 1, name: "VRG Admin", email: null as string | null, role: "admin" as const };

// ─── Router ───────────────────────────────────────────────────────────────────

const router = {
  auth: {
    me: query(async () => (isAuthed() ? ADMIN_USER : null)),
    logout: mutation(async () => {
      clearToken();
      return { success: true } as const;
    }),
    login: mutation(async (input: { password: string }) => {
      const r = await api<{ token: string; role: "admin" | "member" }>("login", {
        method: "POST",
        body: { password: input.password },
      });
      setToken(r.token);
      return { success: true, role: r.role } as const;
    }),
  },
  dashboard: {
    stats: query(async () => {
      const year = new Date().getFullYear();
      const { submissions, members } = await fetchReport(
        new Date(year, 0, 1),
        new Date(year, 11, 31, 23, 59, 59)
      );
      return {
        totalSubmissions: submissions.length,
        totalMembers: members.filter((m) => m.active).length,
      };
    }),
    weeklyReport: query(async (input: { fromDate: Date; toDate: Date }) => {
      const { submissions, members } = await fetchReport(input.fromDate, input.toDate);
      const memberMap = new Map(members.map((m) => [m.id, m]));
      return submissions.map((s) => ({ ...s, member: memberMap.get(s.memberId) ?? null }));
    }),
    memberReport: query(async (input: { memberId: number }) => {
      const r = await api<{ member: RawMember; submissions: RawSubmission[]; members: RawMember[] }>(
        `admin/member-report?memberId=${input.memberId}`
      );
      return {
        member: reviveMember(r.member),
        submissions: r.submissions.map(reviveSubmission),
        memberMap: Object.fromEntries(r.members.map((m) => [m.id, reviveMember(m)])),
      };
    }),
    absenceSummary: query(async (input: { fromDate: Date; toDate: Date }) => {
      const { submissions, members } = await fetchReport(input.fromDate, input.toDate);
      const byMember = new Map<number, { member: Member; absences: ParsedSubmission[] }>(
        members.filter((m) => m.active).map((m) => [m.id, { member: m, absences: [] }])
      );
      for (const s of submissions) {
        if (!s.attended) byMember.get(s.memberId)?.absences.push(s);
      }
      return Array.from(byMember.values()).sort((a, b) => b.absences.length - a.absences.length);
    }),
  },
  goals: {
    ytdSummary: query(async () => {
      const s = await fetchSummary();
      return { ytd: s.ytd, goals: s.goals ? { ...s.goals, money: Number(s.goals.money) } : null };
    }),
    monthSummary: query(async () => {
      const s = await fetchSummary();
      return {
        month: s.month,
        monthName: s.monthName,
        goals: s.goals ? { ...s.goals, money: Number(s.goals.money) } : null,
      };
    }),
    set: mutation(
      (input: { year: number; referrals: number; oneToOnes: number; money: number; visitors: number }) =>
        api("admin/goals", { method: "PUT", body: input })
    ),
  },
  members: {
    list: query(async () => (await api<RawMember[]>("members")).map(reviveMember)),
    listAll: query(async () => (await api<RawMember[]>("admin/members")).map(reviveMember)),
    create: mutation((input: { name: string; email?: string | null }) =>
      api("admin/members", { method: "POST", body: input })
    ),
    update: mutation((input: { id: number; name?: string; email?: string | null; active?: boolean }) => {
      const { id, ...body } = input;
      return api(`admin/members/${id}`, { method: "PUT", body });
    }),
    delete: mutation((input: { id: number }) => api(`admin/members/${input.id}`, { method: "DELETE" })),
  },
  notes: {
    get: query(async (input: { memberId: number; meetingDate: string }) => {
      const row = await api<RawNoteRow | null>(
        `notes?memberId=${input.memberId}&meetingDate=${encodeURIComponent(input.meetingDate)}`
      );
      if (!row) return null;
      let memberNotes: Record<string, string> = {};
      try {
        memberNotes = JSON.parse(row.memberNotes);
      } catch {
        /* corrupt cell — start fresh */
      }
      return {
        memberId: row.memberId,
        meetingDate: row.meetingDate,
        presentationNotes: row.presentationNotes,
        educationalNotes: row.educationalNotes,
        memberNotes,
      } satisfies NoteDoc;
    }),
    save: mutation((doc: NoteDoc) => api("notes", { method: "PUT", body: doc })),
  },
  agenda: {
    get: query(() => api<AgendaDoc>("agenda")),
    set: mutation((doc: AgendaDoc) => api("admin/agenda", { method: "PUT", body: doc })),
  },
  backup: {
    toSheet: mutation(() => api<{ rows: number }>("admin/backup-sheet", { method: "POST" })),
  },
  submissions: {
    create: mutation(
      (input: {
        memberId: number;
        meetingDate: Date;
        attended: boolean;
        absenceReason?: string | null;
        visitorsCount: number;
        referrals?: { toMemberId: string; count: string }[];
        oneToOnes?: number[];
        moneyReceived?: { fromMemberId: string; amount: string }[];
      }) =>
        api("submissions", {
          method: "POST",
          body: {
            memberId: input.memberId,
            meetingDate: input.meetingDate.toISOString(),
            attended: input.attended,
            absenceReason: input.absenceReason ?? null,
            visitorsCount: input.visitorsCount,
            referrals: (input.referrals ?? []).map((r) => ({
              toMemberId: Number(r.toMemberId),
              count: Number(r.count) || 0,
            })),
            oneToOnes: input.oneToOnes ?? [],
            moneyReceived: (input.moneyReceived ?? []).map((m) => ({
              fromMemberId: Number(m.fromMemberId),
              amount: Number(m.amount) || 0,
            })),
          },
        })
    ),
  },
};

export const trpc = {
  ...router,
  /** Query invalidation helpers, mirroring `trpc.useUtils()` in the real app. */
  useUtils: () => router,
};
