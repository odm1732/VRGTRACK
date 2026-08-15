import { DEMO_ADMIN_EMAIL } from "./seed";
import { getState, mutate, nextId } from "./store";
import type { Goal, Member, MoneyReceived, Referral, Role, Submission, User } from "./types";

/**
 * In-browser stand-in for server/routers.ts. Every resolver reproduces the
 * real tRPC procedure's behaviour against the local demo dataset, so the
 * pages copied out of the app run unmodified.
 */

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
  return { from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59) };
}

function getMonthBounds(year: number, month: number) {
  return { from: new Date(year, month, 1), to: new Date(year, month + 1, 0, 23, 59, 59) };
}

function inRange(s: Submission, from: Date, to: Date) {
  const t = new Date(s.meetingDate).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function totalsFor(subs: Submission[]) {
  let referrals = 0;
  let oneToOnes = 0;
  let money = 0;
  let visitors = 0;
  for (const s of subs) {
    referrals += parseJsonSafe<Referral[]>(s.referrals, []).reduce((sum, r) => sum + (Number(r.count) || 0), 0);
    oneToOnes += parseJsonSafe<number[]>(s.oneToOnes, []).length;
    money += parseJsonSafe<MoneyReceived[]>(s.moneyReceived, []).reduce(
      (sum, m) => sum + (Number(m.amount) || 0),
      0
    );
    visitors += s.visitorsCount || 0;
  }
  return { referrals, oneToOnes, money, visitors };
}

function withParsed(s: Submission) {
  return {
    ...s,
    referralsParsed: parseJsonSafe<Referral[]>(s.referrals, []),
    oneToOnesParsed: parseJsonSafe<number[]>(s.oneToOnes, []),
    moneyReceivedParsed: parseJsonSafe<MoneyReceived[]>(s.moneyReceived, []),
  };
}

function goalsForYear(year: number): Goal | null {
  return getState().goals.find((g) => g.year === year) ?? null;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function me(): User | null {
  const { users, sessionUserId } = getState();
  return users.find((u) => u.id === sessionUserId) ?? null;
}

export function logout() {
  mutate((draft) => {
    draft.sessionUserId = null;
  });
  return { success: true } as const;
}

function newUser(input: { name: string; email: string; role?: Role }): User {
  const now = new Date();
  return {
    id: nextId(getState().users),
    openId: null,
    name: input.name,
    email: input.email,
    loginMethod: "password",
    role: input.role ?? "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

function signIn(userId: number) {
  mutate((draft) => {
    draft.sessionUserId = userId;
    const user = draft.users.find((u) => u.id === userId);
    if (user) user.lastSignedIn = new Date();
  });
}

/**
 * The demo has no password store. Any password is accepted; the email decides
 * which role you land in, so both the admin and the read-only view are
 * reachable from the sign-in screen.
 */
export function login(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = getState().users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    signIn(existing.id);
    return { success: true, user: existing };
  }

  const created = newUser({ name: input.email.split("@")[0], email: input.email });
  mutate((draft) => {
    draft.users.push(created);
    draft.sessionUserId = created.id;
  });
  return { success: true, user: created };
}

export function loginAsDemoAdmin() {
  const admin = getState().users.find((u) => u.email === DEMO_ADMIN_EMAIL) ?? getState().users[0];
  signIn(admin.id);
  return { success: true, user: admin };
}

export function register(input: { name: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (getState().users.some((u) => u.email?.toLowerCase() === email)) {
    throw new Error("An account with this email already exists.");
  }
  const created = newUser({ name: input.name, email: input.email });
  mutate((draft) => {
    draft.users.push(created);
    draft.sessionUserId = created.id;
  });
  return { success: true, user: created };
}

export function requestPasswordReset(input: { email: string }) {
  // The real router always reports success to avoid email enumeration, and
  // returns the token so an admin can hand it over directly.
  const email = input.email.trim().toLowerCase();
  const user = getState().users.find((u) => u.email?.toLowerCase() === email);
  if (!user) return { success: true as const, resetToken: undefined };
  return { success: true as const, resetToken: `demo-reset-${user.id}-token` };
}

export function resetPassword(input: { token: string; password: string }) {
  const match = /^demo-reset-(\d+)-token$/.exec(input.token.trim());
  if (!match) throw new Error("Invalid or expired reset token.");
  const userId = Number(match[1]);
  if (!getState().users.some((u) => u.id === userId)) {
    throw new Error("Invalid or expired reset token.");
  }
  signIn(userId);
  return { success: true } as const;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function stats() {
  const { submissions, members } = getState();
  const totals = totalsFor(submissions);
  return {
    totalSubmissions: submissions.length,
    totalMembers: members.filter((m) => m.active).length,
    totalReferrals: totals.referrals,
    totalOneToOnes: totals.oneToOnes,
    totalMoney: totals.money,
    totalVisitors: totals.visitors,
  };
}

export function weeklyReport(input: { fromDate: Date; toDate: Date }) {
  const { submissions, members } = getState();
  const memberMap = new Map(members.map((m) => [m.id, m]));
  return submissions
    .filter((s) => inRange(s, input.fromDate, input.toDate))
    .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())
    .map((s) => ({ ...withParsed(s), member: memberMap.get(s.memberId) ?? null }));
}

export function memberReport(input: { memberId: number }) {
  const { submissions, members } = getState();
  const member = members.find((m) => m.id === input.memberId);
  if (!member) throw new Error("Member not found");
  return {
    member,
    submissions: submissions
      .filter((s) => s.memberId === input.memberId)
      .sort((a, b) => new Date(b.meetingDate).getTime() - new Date(a.meetingDate).getTime())
      .map(withParsed),
    memberMap: Object.fromEntries(members.map((m) => [m.id, m])),
  };
}

export function absenceSummary(input: { fromDate: Date; toDate: Date }) {
  const { submissions, members } = getState();
  const active = members.filter((m) => m.active);
  const byMember = new Map<number, { member: Member; absences: Submission[] }>(
    active.map((m) => [m.id, { member: m, absences: [] }])
  );
  for (const s of submissions) {
    if (s.attended || !inRange(s, input.fromDate, input.toDate)) continue;
    byMember.get(s.memberId)?.absences.push(s);
  }
  return Array.from(byMember.values()).sort((a, b) => b.absences.length - a.absences.length);
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export function ytdSummary() {
  const year = new Date().getFullYear();
  const { from, to } = getYearBounds(year);
  const subs = getState().submissions.filter((s) => inRange(s, from, to));
  return { ytd: totalsFor(subs), goals: goalsForYear(year) };
}

export function monthSummary() {
  const now = new Date();
  const { from, to } = getMonthBounds(now.getFullYear(), now.getMonth());
  const subs = getState().submissions.filter((s) => inRange(s, from, to));
  return {
    month: totalsFor(subs),
    monthName: now.toLocaleString("default", { month: "long" }),
    goals: goalsForYear(now.getFullYear()),
  };
}

export function setGoals(input: {
  year: number;
  referrals: number;
  oneToOnes: number;
  money: number;
  visitors: number;
}) {
  mutate((draft) => {
    const existing = draft.goals.find((g) => g.year === input.year);
    if (existing) {
      Object.assign(existing, input, { updatedAt: new Date() });
    } else {
      draft.goals.push({
        id: nextId(draft.goals),
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  });
  return { success: true } as const;
}

// ─── Members ──────────────────────────────────────────────────────────────────

export function listMembers() {
  return getState()
    .members.filter((m) => m.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listAllMembers() {
  return [...getState().members].sort((a, b) => a.name.localeCompare(b.name));
}

export function createMember(input: { name: string; email?: string | null }) {
  mutate((draft) => {
    draft.members.push({
      id: nextId(draft.members),
      name: input.name,
      email: input.email || null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });
  return { success: true } as const;
}

export function updateMember(input: {
  id: number;
  name?: string;
  email?: string | null;
  active?: boolean;
}) {
  mutate((draft) => {
    const member = draft.members.find((m) => m.id === input.id);
    if (!member) throw new Error("Member not found");
    if (input.name !== undefined) member.name = input.name;
    if (input.email !== undefined) member.email = input.email || null;
    if (input.active !== undefined) member.active = input.active;
    member.updatedAt = new Date();
  });
  return { success: true } as const;
}

export function deleteMember(input: { id: number }) {
  mutate((draft) => {
    draft.members = draft.members.filter((m) => m.id !== input.id);
  });
  return { success: true } as const;
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export function createSubmission(input: {
  memberId: number;
  meetingDate: Date;
  attended: boolean;
  absenceReason?: string | null;
  visitorsCount: number;
  referrals?: { toMemberId: string; count: string }[];
  oneToOnes?: number[];
  moneyReceived?: { fromMemberId: string; amount: string }[];
}) {
  const referrals = (input.referrals ?? []).map((r) => ({
    toMemberId: Number(r.toMemberId),
    count: Number(r.count) || 0,
  }));
  const moneyReceived = (input.moneyReceived ?? []).map((m) => ({
    fromMemberId: Number(m.fromMemberId),
    amount: Number(m.amount) || 0,
  }));
  mutate((draft) => {
    draft.submissions.push({
      id: nextId(draft.submissions),
      memberId: input.memberId,
      meetingDate: input.meetingDate,
      attended: input.attended,
      absenceReason: input.absenceReason ?? null,
      visitorsCount: input.visitorsCount,
      referrals: referrals.length ? JSON.stringify(referrals) : null,
      oneToOnes: input.oneToOnes?.length ? JSON.stringify(input.oneToOnes) : null,
      moneyReceived: moneyReceived.length ? JSON.stringify(moneyReceived) : null,
      createdAt: new Date(),
    });
  });
  return { success: true } as const;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function listAllUsers() {
  return [...getState().users].sort((a, b) => a.id - b.id);
}

export function createUser(input: { name: string; email: string }) {
  const email = input.email.trim().toLowerCase();
  if (getState().users.some((u) => u.email?.toLowerCase() === email)) {
    throw new Error("A user with this email already exists.");
  }
  const created = newUser({ name: input.name, email: input.email });
  mutate((draft) => {
    draft.users.push(created);
  });
  return { success: true } as const;
}

export function updateUserRole(input: { userId: number; role: Role }) {
  mutate((draft) => {
    const user = draft.users.find((u) => u.id === input.userId);
    if (!user) throw new Error("User not found");
    user.role = input.role;
    user.updatedAt = new Date();
  });
  return { success: true } as const;
}

export function removeUser(input: { userId: number }) {
  const current = me();
  if (current?.role !== "admin") throw new Error("Admin only.");
  if (current.id === input.userId) throw new Error("Cannot remove yourself.");
  mutate((draft) => {
    draft.users = draft.users.filter((u) => u.id !== input.userId);
  });
  return { success: true } as const;
}
