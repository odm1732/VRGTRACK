import type { DemoState, Goal, Member, Submission, User } from "./types";

export const SEED_VERSION = 2;

/** Credentials shown on the demo sign-in screen. */
export const DEMO_ADMIN_EMAIL = "admin@vrgdemo.com";
export const DEMO_ADMIN_PASSWORD = "vrgdemo123";

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

/** Every Tuesday of `year` that has already happened, up to and including today. */
function meetingDates(year: number, today: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(year, 0, 1);
  // advance to the first Tuesday (day 2)
  cursor.setDate(cursor.getDate() + ((2 - cursor.getDay() + 7) % 7));
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  while (cursor.getFullYear() === year && cursor <= cutoff) {
    dates.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 8, 0, 0));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

function pickDistinct(rand: () => number, pool: number[], count: number): number[] {
  const copy = [...pool];
  const out: number[] = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
}

/**
 * Closed-business amounts span handyman invoices to real-estate closings, so
 * draw from a mixture: mostly small jobs, some mid-size, the odd big close.
 */
function moneyAmount(rand: () => number): number {
  const roll = rand();
  if (roll < 0.7) return Math.round((800 + rand() * 8200) / 50) * 50;
  if (roll < 0.95) return Math.round((10000 + rand() * 35000) / 250) * 250;
  return Math.round((60000 + rand() * 90000) / 1000) * 1000;
}

export function buildSeedState(now: Date = new Date()): DemoState {
  const year = now.getFullYear();
  const rand = mulberry32(0x5652_4700 ^ year);
  const jan1 = new Date(year, 0, 1, 9, 0, 0);

  const members: Member[] = MEMBER_SEED.map((m, i) => ({
    id: i + 1,
    name: m.name,
    email: m.email ?? null,
    active: m.active !== false,
    createdAt: jan1,
    updatedAt: jan1,
  }));

  const activeIds = members.filter((m) => m.active).map((m) => m.id);
  const submissions: Submission[] = [];
  let submissionId = 1;

  // Weekly activity is generated (no submission history was exported), with
  // rates tuned so the year-to-date tracks plausibly against the real 2026
  // goals: 200 referrals, 350 one-to-ones, $5M closed business, 20 visitors.
  for (const meetingDate of meetingDates(year, now)) {
    for (const memberId of activeIds) {
      // A couple of members skip filing a report on any given week.
      if (rand() < 0.06) continue;

      const attended = rand() > 0.11;
      if (!attended) {
        submissions.push({
          id: submissionId++,
          memberId,
          meetingDate,
          attended: false,
          absenceReason: ABSENCE_REASONS[Math.floor(rand() * ABSENCE_REASONS.length)],
          visitorsCount: 0,
          referrals: null,
          oneToOnes: null,
          moneyReceived: null,
          createdAt: meetingDate,
        });
        continue;
      }

      const others = activeIds.filter((id) => id !== memberId);

      const referralRoll = rand();
      const referralCount = referralRoll < 0.79 ? 0 : referralRoll < 0.97 ? 1 : 2;
      const referrals = pickDistinct(rand, others, referralCount).map((toMemberId) => ({
        toMemberId,
        count: 1,
      }));

      const otoRoll = rand();
      const otoCount = otoRoll < 0.66 ? 0 : otoRoll < 0.96 ? 1 : 2;
      const oneToOnes = pickDistinct(rand, others, otoCount);

      const moneyReceived =
        rand() < 0.28
          ? pickDistinct(rand, others, 1).map((fromMemberId) => ({
              fromMemberId,
              amount: moneyAmount(rand),
            }))
          : [];

      const visitorsCount = rand() < 0.022 ? 1 : 0;

      submissions.push({
        id: submissionId++,
        memberId,
        meetingDate,
        attended: true,
        absenceReason: null,
        visitorsCount,
        referrals: referrals.length ? JSON.stringify(referrals) : null,
        oneToOnes: oneToOnes.length ? JSON.stringify(oneToOnes) : null,
        moneyReceived: moneyReceived.length ? JSON.stringify(moneyReceived) : null,
        createdAt: meetingDate,
      });
    }
  }

  // The group's real annual goals, from the meeting agenda.
  const goals: Goal[] = [
    {
      id: 1,
      year,
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
    seedYear: year,
    members,
    submissions,
    goals,
    users,
    sessionUserId: null,
  };
}
