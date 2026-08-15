import {
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier – null for email/password-only accounts */
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  /** bcrypt hash – null for OAuth-only accounts */
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Token for password-reset emails */
  passwordResetToken: varchar("passwordResetToken", { length: 128 }),
  passwordResetExpiry: timestamp("passwordResetExpiry"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Members ──────────────────────────────────────────────────────────────────

export const members = mysqlTable("members", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Member = typeof members.$inferSelect;
export type InsertMember = typeof members.$inferInsert;

// ─── Submissions ──────────────────────────────────────────────────────────────

export const submissions = mysqlTable("submissions", {
  id: int("id").autoincrement().primaryKey(),
  memberId: int("memberId").notNull(),
  meetingDate: timestamp("meetingDate").notNull(),
  attended: boolean("attended").default(true).notNull(),
  absenceReason: text("absenceReason"),
  visitorsCount: int("visitorsCount").default(0).notNull(),
  /** JSON array of referral objects: [{toMemberId, count}] */
  referrals: text("referrals"),
  /** JSON array of member IDs who had one-to-ones */
  oneToOnes: text("oneToOnes"),
  /** JSON array of money received objects: [{fromMemberId, amount}] */
  moneyReceived: text("moneyReceived"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = typeof submissions.$inferInsert;

// ─── Goals ────────────────────────────────────────────────────────────────────

export const goals = mysqlTable("goals", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull().unique(),
  referrals: int("referrals").default(200).notNull(),
  oneToOnes: int("oneToOnes").default(350).notNull(),
  money: decimal("money", { precision: 15, scale: 2 }).default("5000000").notNull(),
  visitors: int("visitors").default(20).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Goal = typeof goals.$inferSelect;
export type InsertGoal = typeof goals.$inferInsert;
