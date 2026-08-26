import type { DemoState, Goal, Member, Submission, User } from "./types";

export const SEED_VERSION = 4;

/** Credentials shown on the demo sign-in screen. */
export const DEMO_ADMIN_EMAIL = "admin@vrgdemo.com";
export const DEMO_ADMIN_PASSWORD = "vrgdemo123";

/**
 * Real group totals as reported from the live tracker. The last recorded
 * activity was August 19, 2026, so meetings are generated from January 1
 * through that date and nothing after it. The rollups match these figures
 * exactly; the per-member weekly breakdown is approximated from them, since
 * only the totals survived.
 */
const DATA_END = { year: 2026, month: 7, day: 19 }; // Aug 19, 2026
const YTD = { referrals: 154, oneToOnes: 391, money: 2_037_230, visitors: 29 };
const MTD = { referrals: 10, oneToOnes: 42, money: 27_198, visitors: 2 }; // August

/**
 * Deterministic PRNG so every visitor sees the same numbers, and so a page
 * reload never reshuffles the dataset underneath a screenshot.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The real Valley Referral Group roster (Tuesday 8:00–9:30am). Names only —
 * the roster's phone numbers and birth dates are deliberately left out, and
 * no per-member emails exist on it.
 */
const MEMBER_SEED: { name: string; email?: string | null; active?: boolean }[] = [
  { name: "Alan Stamp" },
  { name: "Arturo and Mariela Suarez" },
  { name: "Bev Cundiff" },
  { name: "Chris McVey" },
  { name: "Daley Goff" },
  { name: "Darren Crosier" },
  { name: "David Heller" },
  { name: "Dustin Cason" },
  { name: "Dylan Clark" },
  { name: "Jeff Williams" },
  { name: "Jordan Taylor" },
  { name: "Josh Cole" },
  { name: "Jonathan Tinnin" },
  { name: "Michelle Fix" },
  { name: "Pat Kincheloe" },
  { name: "Ralph Smith" },
  { name: "Sandy Zamalis" },
  { name: "Sarah Fowler" },
  { name: "Scott Danielson" },
  { name: "Shelton Mason" },
  { name: "Tina Raybon" },
  { name: "Teresa Whitesell" },
];

const ABSENCE_REASONS = [
  "Out of town for a client install.",
  "Family commitment.",
  "Sick — sent a substitute.",
  "Scheduling conflict with a closing.",
  "Vacation week.",
  "Jury duty.",
];

const USER_SEED: { name: string; email: string; role: "admin" | "user"; loginMethod: string }[] = [
  { name: "Demo Admin", email: DEMO_ADMIN_EMAIL, role: "admin", loginMethod: "password" },
  { name: "Valley Referral Group", email: "networkwithvrg@gmail.com", role: "user", loginMethod: "google" },
];

/** Every Tuesday from January 1 of the data year through the data-end date. */
function meetingDates(): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(DATA_END.year, 0, 1);
  cursor.setDate(cursor.getDate() + ((2 - cursor.getDay() + 7) % 7)); // first Tuesday
  const cutoff = new Date(DATA_END.year, DATA_END.month, DATA_END.day, 23, 59, 59);
  while (cursor <= cutoff) {
    dates.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 8, 0, 0));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

/** Mutable submission under construction, before JSON serialization. */
type DraftSub = {
  memberId: number;
  meetingDate: Date;
  attended: boolean;
  absenceReason: string | null;
  visitorsCount: number;
  refs: { toMemberId: number; count: number }[];
  otos: number[];
  moneys: { fromMemberId: number; amount: number }[];
};

function pickOther(rand: () => number, activeIds: number[], memberId: number): number {
  const others = activeIds.filter((id) => id !== memberId);
  return others[Math.floor(rand() * others.length)];
}

/**
 * Spread exact metric totals across a pool of attended submissions so the
 * period's rollup matches the real reported numbers to the dollar.
 */
function allocateExact(
  rand: () => number,
  pool: DraftSub[],
  activeIds: number[],
  targets: { referrals: number; oneToOnes: number; money: number; visitors: number }
) {
  if (pool.length === 0) return;
  const pick = () => pool[Math.floor(rand() * pool.length)];

  for (let i = 0; i < targets.referrals; i++) {
    const s = pick();
    s.refs.push({ toMemberId: pickOther(rand, activeIds, s.memberId), count: 1 });
  }

  for (let i = 0; i < targets.oneToOnes; i++) {
    // One-to-ones are unique per submission (checkbox list in the form), so
    // retry until a submission with a free counterpart turns up.
    for (let tries = 0; tries < 60; tries++) {
      const s = pick();
      const free = activeIds.filter((id) => id !== s.memberId && !s.otos.includes(id));
      if (free.length > 0) {
        s.otos.push(free[Math.floor(rand() * free.length)]);
        break;
      }
    }
  }

  for (let i = 0; i < targets.visitors; i++) {
    pick().visitorsCount += 1;
  }

  if (targets.money > 0) {
    // Split the exact dollar total across a realistic number of closes.
    const events = Math.max(1, Math.min(pool.length, Math.round(targets.money / 30_000) + 3));
    const weights = Array.from({ length: events }, () => 0.25 + rand());
    const weightSum = weights.reduce((a, b) => a + b, 0);
    let remaining = targets.money;
    for (let i = 0; i < events; i++) {
      const amount =
        i === events - 1 ? remaining : Math.min(remaining, Math.round((targets.money * weights[i]) / weightSum));
      if (amount <= 0) continue;
      remaining -= amount;
      const s = pick();
      s.moneys.push({ fromMemberId: pickOther(rand, activeIds, s.memberId), amount });
    }
  }
}

export function buildSeedState(now: Date = new Date()): DemoState {
  const rand = mulberry32(0x5652_4700 ^ DATA_END.year);
  const jan1 = new Date(DATA_END.year, 0, 1, 9, 0, 0);

  const members: Member[] = MEMBER_SEED.map((m, i) => ({
    id: i + 1,
    name: m.name,
    email: m.email ?? null,
    active: m.active !== false,
    createdAt: jan1,
    updatedAt: jan1,
  }));

  const activeIds = members.filter((m) => m.active).map((m) => m.id);

  // Attendance first, activity second: the exact totals are then spread
  // across whoever attended in each period.
  const drafts: DraftSub[] = [];
  for (const meetingDate of meetingDates()) {
    for (const memberId of activeIds) {
      if (rand() < 0.06) continue; // skipped filing a report that week
      const attended = rand() > 0.11;
      drafts.push({
        memberId,
        meetingDate,
        attended,
        absenceReason: attended
          ? null
          : ABSENCE_REASONS[Math.floor(rand() * ABSENCE_REASONS.length)],
        visitorsCount: 0,
        refs: [],
        otos: [],
        moneys: [],
      });
    }
  }

  const monthStart = new Date(DATA_END.year, DATA_END.month, 1);
  allocateExact(
    rand,
    drafts.filter((s) => s.attended && s.meetingDate < monthStart),
    activeIds,
    {
      referrals: YTD.referrals - MTD.referrals,
      oneToOnes: YTD.oneToOnes - MTD.oneToOnes,
      money: YTD.money - MTD.money,
      visitors: YTD.visitors - MTD.visitors,
    }
  );
  allocateExact(
    rand,
    drafts.filter((s) => s.attended && s.meetingDate >= monthStart),
    activeIds,
    MTD
  );

  let submissionId = 1;
  const submissions: Submission[] = drafts.map((s) => ({
    id: submissionId++,
    memberId: s.memberId,
    meetingDate: s.meetingDate,
    attended: s.attended,
    absenceReason: s.absenceReason,
    visitorsCount: s.visitorsCount,
    referrals: s.refs.length ? JSON.stringify(s.refs) : null,
    oneToOnes: s.otos.length ? JSON.stringify(s.otos) : null,
    moneyReceived: s.moneys.length ? JSON.stringify(s.moneys) : null,
    createdAt: s.meetingDate,
  }));

  // The group's real annual goals, from the meeting agenda.
  const goals: Goal[] = [
    {
      id: 1,
      year: DATA_END.year,
      referrals: 200,
      oneToOnes: 350,
      money: 5000000,
      visitors: 20,
      createdAt: jan1,
      updatedAt: jan1,
    },
  ];

  const users: User[] = USER_SEED.map((u, i) => ({
    id: i + 1,
    openId: u.loginMethod === "google" ? `demo-openid-${i + 1}` : null,
    name: u.name,
    email: u.email,
    loginMethod: u.loginMethod,
    role: u.role,
    createdAt: jan1,
    updatedAt: jan1,
    lastSignedIn: new Date(now.getTime() - i * 26 * 60 * 60 * 1000),
  }));

  return {
    seedVersion: SEED_VERSION,
    seedYear: DATA_END.year,
    members,
    submissions,
    goals,
    users,
    sessionUserId: null,
  };
}
