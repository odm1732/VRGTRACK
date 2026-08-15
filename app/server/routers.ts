import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createEmailUser,
  createMember,
  createSubmission,
  deleteMember,
  getActiveMembers,
  getAllMembers,
  getAllSubmissions,
  getAllUsers,
  getGoalsByYear,
  getMemberById,
  getSubmissionsByDateRange,
  getSubmissionsByMember,
  getUserByEmail,
  getUserById,
  getUserByResetToken,
  setPasswordResetToken,
  updateMember,
  updateUserLastSignedIn,
  updateUserPassword,
  updateUserRole,
  upsertGoals,
  deleteUser,
} from "./db";
import { createSessionToken } from "./_core/session";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonSafe<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function getYearBounds(year: number) {
  return {
    from: new Date(year, 0, 1),
    to: new Date(year, 11, 31, 23, 59, 59),
  };
}

function getMonthBounds(year: number, month: number) {
  return {
    from: new Date(year, month, 1),
    to: new Date(year, month + 1, 0, 23, 59, 59),
  };
}

// ─── Auth Router ──────────────────────────────────────────────────────────────

const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.string().email("Invalid email address"),
        password: z
          .string()
          .min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      await createEmailUser({
        name: input.name,
        email: input.email,
        passwordHash,
        role: "user",
      });

      const user = await getUserByEmail(input.email);
      if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const token = await createSessionToken(user);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

      return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    }),

  login: publicProcedure
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(1, "Password is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      await updateUserLastSignedIn(user.id);

      const token = await createSessionToken(user);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

      return { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } };
    }),

  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email);
      // Always return success to prevent email enumeration
      if (!user) return { success: true };

      const token = nanoid(48);
      const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
      await setPasswordResetToken(user.id, token, expiry);

      // In production you'd send an email here; for now we return the token
      // so admins can share it directly with users
      console.log(`[Password Reset] Token for ${input.email}: ${token}`);

      return { success: true, resetToken: token };
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await getUserByResetToken(input.token);
      if (!user) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token.",
        });
      }
      if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Reset token has expired. Please request a new one.",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);
      await updateUserPassword(user.id, passwordHash);

      // Auto sign-in after reset
      const token = await createSessionToken(user);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

      return { success: true };
    }),
});

// ─── Dashboard Router ─────────────────────────────────────────────────────────

const dashboardRouter = router({
  stats: protectedProcedure.query(async () => {
    const all = await getAllSubmissions();
    const memberList = await getAllMembers();

    let totalReferrals = 0;
    let totalOneToOnes = 0;
    let totalMoney = 0;
    let totalVisitors = 0;

    for (const s of all) {
      const refs = parseJsonSafe<{ toMemberId: number; count: number }[]>(s.referrals, []);
      totalReferrals += refs.reduce((sum, r) => sum + (r.count || 0), 0);
      const oto = parseJsonSafe<number[]>(s.oneToOnes, []);
      totalOneToOnes += oto.length;
      totalMoney += s.moneyReceived
        ? parseJsonSafe<{ fromMemberId: number; amount: number }[]>(s.moneyReceived, []).reduce(
            (sum, m) => sum + (m.amount || 0),
            0
          )
        : 0;
      totalVisitors += s.visitorsCount || 0;
    }

    return {
      totalSubmissions: all.length,
      totalMembers: memberList.filter((m) => m.active).length,
      totalReferrals,
      totalOneToOnes,
      totalMoney,
      totalVisitors,
    };
  }),

  weeklyReport: protectedProcedure
    .input(
      z.object({
        fromDate: z.date(),
        toDate: z.date(),
      })
    )
    .query(async ({ input }) => {
      const subs = await getSubmissionsByDateRange(input.fromDate, input.toDate);
      const memberList = await getAllMembers();
      const memberMap = new Map(memberList.map((m) => [m.id, m]));

      return subs.map((s) => ({
        ...s,
        member: memberMap.get(s.memberId) ?? null,
        referralsParsed: parseJsonSafe<{ toMemberId: number; count: number }[]>(s.referrals, []),
        oneToOnesParsed: parseJsonSafe<number[]>(s.oneToOnes, []),
        moneyReceivedParsed: parseJsonSafe<{ fromMemberId: number; amount: number }[]>(s.moneyReceived, []),
      }));
    }),

  memberReport: protectedProcedure
    .input(z.object({ memberId: z.number() }))
    .query(async ({ input }) => {
      const member = await getMemberById(input.memberId);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

      const subs = await getSubmissionsByMember(input.memberId);
      const memberList = await getAllMembers();
      const memberMap = new Map(memberList.map((m) => [m.id, m]));

      return {
        member,
        submissions: subs.map((s) => ({
          ...s,
          referralsParsed: parseJsonSafe<{ toMemberId: number; count: number }[]>(s.referrals, []),
          oneToOnesParsed: parseJsonSafe<number[]>(s.oneToOnes, []),
          moneyReceivedParsed: parseJsonSafe<{ fromMemberId: number; amount: number }[]>(s.moneyReceived, []),
        })),
        memberMap: Object.fromEntries(memberMap),
      };
    }),

  absenceSummary: protectedProcedure
    .input(
      z.object({
        fromDate: z.date(),
        toDate: z.date(),
      })
    )
    .query(async ({ input }) => {
      const subs = await getSubmissionsByDateRange(input.fromDate, input.toDate);
      const memberList = await getActiveMembers();

      const absenceMap = new Map<number, { member: typeof memberList[0]; absences: typeof subs }>();
      for (const m of memberList) {
        absenceMap.set(m.id, { member: m, absences: [] });
      }
      for (const s of subs) {
        if (!s.attended) {
          const entry = absenceMap.get(s.memberId);
          if (entry) entry.absences.push(s);
        }
      }

      return Array.from(absenceMap.values()).sort(
        (a, b) => b.absences.length - a.absences.length
      );
    }),
});

// ─── Goals Router ─────────────────────────────────────────────────────────────

const goalsRouter = router({
  get: publicProcedure
    .input(z.object({ year: z.number() }))
    .query(async ({ input }) => {
      const g = await getGoalsByYear(input.year);
      if (!g) return null;
      return {
        ...g,
        money: Number(g.money),
      };
    }),

  set: protectedProcedure
    .input(
      z.object({
        year: z.number(),
        referrals: z.number().min(0),
        oneToOnes: z.number().min(0),
        money: z.number().min(0),
        visitors: z.number().min(0),
      })
    )
    .mutation(async ({ input }) => {
      await upsertGoals(input);
      return { success: true };
    }),

  ytdSummary: publicProcedure.query(async () => {
    const year = new Date().getFullYear();
    const { from, to } = getYearBounds(year);
    const subs = await getSubmissionsByDateRange(from, to);
    const g = await getGoalsByYear(year);

    let referrals = 0;
    let oneToOnes = 0;
    let money = 0;
    let visitors = 0;

    for (const s of subs) {
      const refs = parseJsonSafe<{ toMemberId: number; count: number }[]>(s.referrals, []);
      referrals += refs.reduce((sum, r) => sum + (r.count || 0), 0);
      const oto = parseJsonSafe<number[]>(s.oneToOnes, []);
      oneToOnes += oto.length;
      money += parseJsonSafe<{ fromMemberId: number; amount: number }[]>(s.moneyReceived, []).reduce(
        (sum, m) => sum + (m.amount || 0),
        0
      );
      visitors += s.visitorsCount || 0;
    }

    return {
      ytd: { referrals, oneToOnes, money, visitors },
      goals: g ? { ...g, money: Number(g.money) } : null,
    };
  }),

  monthSummary: publicProcedure.query(async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const { from, to } = getMonthBounds(year, month);
    const subs = await getSubmissionsByDateRange(from, to);
    const g = await getGoalsByYear(year);

    let referrals = 0;
    let oneToOnes = 0;
    let money = 0;
    let visitors = 0;

    for (const s of subs) {
      const refs = parseJsonSafe<{ toMemberId: number; count: number }[]>(s.referrals, []);
      referrals += refs.reduce((sum, r) => sum + (r.count || 0), 0);
      const oto = parseJsonSafe<number[]>(s.oneToOnes, []);
      oneToOnes += oto.length;
      money += parseJsonSafe<{ fromMemberId: number; amount: number }[]>(s.moneyReceived, []).reduce(
        (sum, m) => sum + (m.amount || 0),
        0
      );
      visitors += s.visitorsCount || 0;
    }

    return {
      month: { referrals, oneToOnes, money, visitors },
      monthName: now.toLocaleString("default", { month: "long" }),
      goals: g ? { ...g, money: Number(g.money) } : null,
    };
  }),
});

// ─── Members Router ───────────────────────────────────────────────────────────

const membersRouter = router({
  list: publicProcedure.query(() => getActiveMembers()),

  listAll: protectedProcedure.query(() => getAllMembers()),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      await createMember({ name: input.name, email: input.email });
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional().nullable(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateMember(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteMember(input.id);
      return { success: true };
    }),
});

// ─── Submissions Router ───────────────────────────────────────────────────────

const submissionsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        memberId: z.number(),
        meetingDate: z.date(),
        attended: z.boolean(),
        absenceReason: z.string().optional().nullable(),
        visitorsCount: z.number().min(0).default(0),
        referrals: z
          .array(z.object({ toMemberId: z.string(), count: z.string() }))
          .optional(),
        oneToOnes: z.array(z.number()).optional(),
        moneyReceived: z
          .array(z.object({ fromMemberId: z.string(), amount: z.string() }))
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      await createSubmission({
        memberId: input.memberId,
        meetingDate: input.meetingDate,
        attended: input.attended,
        absenceReason: input.absenceReason ?? null,
        visitorsCount: input.visitorsCount,
        referrals: input.referrals ? JSON.stringify(input.referrals) : null,
        oneToOnes: input.oneToOnes ? JSON.stringify(input.oneToOnes) : null,
        moneyReceived: input.moneyReceived ? JSON.stringify(input.moneyReceived) : null,
      });
      return { success: true };
    }),
});

// ─── Users Router ─────────────────────────────────────────────────────────────

const usersRouter = router({
  listAll: protectedProcedure.query(() => getAllUsers()),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Valid email required"),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists.",
        });
      }
      // Create without password – user must use "Forgot Password" to set one
      await createEmailUser({
        name: input.name,
        email: input.email,
        passwordHash: "",
        role: "user",
      });
      const user = await getUserByEmail(input.email);
      return { success: true, user };
    }),

  updateRole: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["user", "admin"]),
      })
    )
    .mutation(async ({ input }) => {
      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),
  remove: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only." });
      }
      if (ctx.user.id === input.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot remove yourself." });
      }
      await deleteUser(input.userId);
      return { success: true };
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  dashboard: dashboardRouter,
  goals: goalsRouter,
  members: membersRouter,
  submissions: submissionsRouter,
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
