import { and, asc, between, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import type { InsertUser } from "../drizzle/schema";
import { goals, members, submissions, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  for (const field of ["name", "email", "loginMethod"] as const) {
    const v = user[field];
    if (v !== undefined) {
      values[field] = v ?? null;
      updateSet[field] = v ?? null;
    }
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  // Support synthetic openId for email/password users: "email:<userId>"
  if (openId.startsWith("email:")) {
    const userId = parseInt(openId.slice(6), 10);
    if (!isNaN(userId)) {
      const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      return result[0];
    }
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function createEmailUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role?: "user" | "admin";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(users).values({
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    loginMethod: "email",
    role: data.role ?? "user",
    lastSignedIn: new Date(),
  });
  return result;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ passwordHash, passwordResetToken: null, passwordResetExpiry: null })
    .where(eq(users.id, userId));
}

export async function setPasswordResetToken(
  userId: number,
  token: string,
  expiry: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({ passwordResetToken: token, passwordResetExpiry: expiry })
    .where(eq(users.id, userId));
}

export async function getUserByResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);
  return result[0];
}

export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(asc(users.name));
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getActiveMembers() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(members)
    .where(eq(members.active, true))
    .orderBy(asc(members.name));
}

export async function getAllMembers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(members).orderBy(asc(members.name));
}

export async function getMemberById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(members).where(eq(members.id, id)).limit(1);
  return result[0];
}

export async function createMember(data: { name: string; email?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(members).values({
    name: data.name,
    email: data.email ?? null,
    active: true,
  });
  return result;
}

export async function updateMember(
  id: number,
  data: { name?: string; email?: string | null; active?: boolean }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(members).set(data).where(eq(members.id, id));
}

export async function deleteMember(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(members).where(eq(members.id, id));
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export async function createSubmission(data: {
  memberId: number;
  meetingDate: Date;
  attended: boolean;
  absenceReason?: string | null;
  visitorsCount: number;
  referrals?: string | null;
  oneToOnes?: string | null;
  moneyReceived?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(submissions).values(data);
}

export async function getSubmissionsByDateRange(fromDate: Date, toDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(submissions)
    .where(between(submissions.meetingDate, fromDate, toDate))
    .orderBy(desc(submissions.meetingDate));
}

export async function getSubmissionsByMember(memberId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(submissions)
    .where(eq(submissions.memberId, memberId))
    .orderBy(desc(submissions.meetingDate));
}

export async function getAllSubmissions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(submissions).orderBy(desc(submissions.meetingDate));
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export async function getGoalsByYear(year: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(goals)
    .where(eq(goals.year, year))
    .limit(1);
  return result[0];
}

export async function upsertGoals(data: {
  year: number;
  referrals: number;
  oneToOnes: number;
  money: number;
  visitors: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(goals)
    .values({
      year: data.year,
      referrals: data.referrals,
      oneToOnes: data.oneToOnes,
      money: String(data.money),
      visitors: data.visitors,
    })
    .onDuplicateKeyUpdate({
      set: {
        referrals: data.referrals,
        oneToOnes: data.oneToOnes,
        money: String(data.money),
        visitors: data.visitors,
      },
    });
}

export async function deleteUser(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, userId));
}
