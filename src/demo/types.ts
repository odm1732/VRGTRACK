/**
 * Mirrors the row shapes of the real VRGTrack Drizzle schema (drizzle/schema.ts)
 * so the pages copied from the app compile against the same fields.
 */

export type Role = "user" | "admin";

export type User = {
  id: number;
  openId: string | null;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export type Member = {
  id: number;
  name: string;
  email: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Referral = { toMemberId: number; count: number };
export type MoneyReceived = { fromMemberId: number; amount: number };

export type Submission = {
  id: number;
  memberId: number;
  meetingDate: Date;
  attended: boolean;
  absenceReason: string | null;
  visitorsCount: number;
  /** JSON array of referral objects: [{toMemberId, count}] */
  referrals: string | null;
  /** JSON array of member IDs who had one-to-ones */
  oneToOnes: string | null;
  /** JSON array of money received objects: [{fromMemberId, amount}] */
  moneyReceived: string | null;
  createdAt: Date;
};

export type Goal = {
  id: number;
  year: number;
  referrals: number;
  oneToOnes: number;
  money: number;
  visitors: number;
  createdAt: Date;
  updatedAt: Date;
};

export type DemoState = {
  /** Bumped when the seed shape changes so stale localStorage is discarded. */
  seedVersion: number;
  /** Year the data was generated for; regenerated when the calendar year rolls over. */
  seedYear: number;
  members: Member[];
  submissions: Submission[];
  goals: Goal[];
  users: User[];
  /** id of the signed-in demo user, or null when signed out */
  sessionUserId: number | null;
};
