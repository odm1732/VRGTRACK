import type { DemoState, Goal, Member, Submission, User } from "./types";

export const SEED_VERSION = 1;

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

const MEMBER_SEED: { name: string; email: string; active?: boolean }[] = [
  { name: "Dana Whitfield", email: "dana@whitfieldcpa.com" },
  { name: "Marcus Ellison", email: "marcus@ellisonroofing.com" },
  { name: "Priya Raghunathan", email: "priya@raghunathanlaw.com" },
  { name: "Tom Vasquez", email: "tom@vasquezplumbing.com" },
  { name: "Sheila Brandt", email: "sheila@brandtinsurance.com" },
  { name: "Kevin Okafor", email: "kevin@okaforlending.com" },
  { name: "Rachel Lindstrom", email: "rachel@lindstromdesign.co" },
  { name: "Andre Boateng", email: "andre@boatengfitness.com" },
  { name: "Julia Kowalski", email: "julia@kowalskirealty.com" },
  { name: "Ben Ferraro", email: "ben@ferraroelectric.com" },
  { name: "Nadia Hassan", email: "nadia@hassanchiropractic.com" },
  { name: "Grant Mueller", email: "grant@muellerlandscape.com" },
  { name: "Camille Duval", email: "camille@duvalphotography.com" },
  { name: "Wes Tanaka", email: "wes@tanakaautobody.com" },
  { name: "Holly Prentice", email: "holly@prenticetravel.com", active: false },
  { name: "Rob Sandoval", email: "rob@sandovalhvac.com", active: false },
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
  { name: "Dana Whitfield", email: "dana@whitfieldcpa.com", role: "admin", loginMethod: "password" },
  { name: "Kevin Okafor", email: "kevin@okaforlending.com", role: "user", loginMethod: "google" },
  { name: "Julia Kowalski", email: "julia@kowalskirealty.com", role: "user", loginMethod: "password" },
];

/** Every Wednesday of `year` that has already happened, up to and including today. */
function meetingDates(year: number, today: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(year, 0, 1);
  // advance to the first Wednesday (day 3)
  cursor.setDate(cursor.getDate() + ((3 - cursor.getDay() + 7) % 7));
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  while (cursor.getFullYear() === year && cursor <= cutoff) {
    dates.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 7, 30, 0));
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

export function buildSeedState(now: Date = new Date()): DemoState {
  const year = now.getFullYear();
  const rand = mulberry32(0x5652_4700 ^ year);
  const jan1 = new Date(year, 0, 1, 9, 0, 0);

  const members: Member[] = MEMBER_SEED.map((m, i) => ({
    id: i + 1,
    name: m.name,
    email: m.email,
    active: m.active !== false,
    createdAt: jan1,
    updatedAt: jan1,
  }));

  const activeIds = members.filter((m) => m.active).map((m) => m.id);
  const submissions: Submission[] = [];
  let submissionId = 1;

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
      const referralCount = referralRoll < 0.34 ? 0 : referralRoll < 0.78 ? 1 : referralRoll < 0.95 ? 2 : 3;
      const referrals = pickDistinct(rand, others, referralCount).map((toMemberId) => ({
        toMemberId,
        count: rand() < 0.82 ? 1 : 2,
      }));

      const otoRoll = rand();
      const otoCount = otoRoll < 0.3 ? 0 : otoRoll < 0.72 ? 1 : otoRoll < 0.93 ? 2 : 3;
      const oneToOnes = pickDistinct(rand, others, otoCount);

      const moneyReceived =
        rand() < 0.24
          ? pickDistinct(rand, others, 1).map((fromMemberId) => ({
              fromMemberId,
              amount: Math.round((350 + rand() * 7600) / 25) * 25,
            }))
          : [];

      const visitorRoll = rand();
      const visitorsCount = visitorRoll < 0.9 ? 0 : visitorRoll < 0.985 ? 1 : 2;

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

  const goals: Goal[] = [
    {
      id: 1,
      year,
      referrals: 750,
      oneToOnes: 600,
      money: 600000,
      visitors: 60,
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
