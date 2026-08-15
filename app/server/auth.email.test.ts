import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module so tests don't need a real DB
vi.mock("./db", () => ({
  getUserByEmail: vi.fn(),
  createEmailUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
  getUserByResetToken: vi.fn(),
  setPasswordResetToken: vi.fn(),
  updateUserPassword: vi.fn(),
  updateUserLastSignedIn: vi.fn(),
  getAllUsers: vi.fn(),
  getAllMembers: vi.fn(),
  getActiveMembers: vi.fn(),
  getAllSubmissions: vi.fn(),
  getSubmissionsByDateRange: vi.fn(),
  getSubmissionsByMember: vi.fn(),
  getMemberById: vi.fn(),
  createMember: vi.fn(),
  updateMember: vi.fn(),
  deleteMember: vi.fn(),
  createSubmission: vi.fn(),
  getGoalsByYear: vi.fn(),
  upsertGoals: vi.fn(),
  getUserById: vi.fn(),
  updateUserRole: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock("./_core/session", () => ({
  createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
}));

import * as db from "./db";
import bcrypt from "bcryptjs";

function createPublicCtx(): TrpcContext {
  const cookies: Record<string, string> = {};
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, val: string) => { cookies[name] = val; },
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("auth.register", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers a new user and returns a session", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(undefined);
    vi.mocked(db.createEmailUser).mockResolvedValue(undefined);
    const hashedPw = await bcrypt.hash("password123", 10);
    vi.mocked(db.getUserByEmail).mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      id: 1,
      openId: "email:test@example.com",
      name: "Test User",
      email: "test@example.com",
      passwordHash: hashedPw,
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      passwordResetToken: null,
      passwordResetExpiry: null,
    });

    const ctx = createPublicCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.register({ name: "Test User", email: "test@example.com", password: "password123" });
    expect(result.success).toBe(true);
    expect(result.user.email).toBe("test@example.com");
  });

  it("throws CONFLICT if email already registered", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 1,
      openId: "email:test@example.com",
      name: "Existing",
      email: "test@example.com",
      passwordHash: "hash",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      passwordResetToken: null,
      passwordResetExpiry: null,
    });

    const ctx = createPublicCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.register({ name: "Test", email: "test@example.com", password: "password123" })
    ).rejects.toThrow("already exists");
  });
});

describe("auth.login", () => {
  beforeEach(() => vi.clearAllMocks());

  it("logs in with correct credentials", async () => {
    const hashedPw = await bcrypt.hash("mypassword", 10);
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 2,
      openId: "email:user@example.com",
      name: "Login User",
      email: "user@example.com",
      passwordHash: hashedPw,
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      passwordResetToken: null,
      passwordResetExpiry: null,
    });
    vi.mocked(db.updateUserLastSignedIn).mockResolvedValue(undefined);

    const ctx = createPublicCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.login({ email: "user@example.com", password: "mypassword" });
    expect(result.success).toBe(true);
    expect(result.user.email).toBe("user@example.com");
  });

  it("throws UNAUTHORIZED for wrong password", async () => {
    const hashedPw = await bcrypt.hash("correctpassword", 10);
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 3,
      openId: "email:user@example.com",
      name: "User",
      email: "user@example.com",
      passwordHash: hashedPw,
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      passwordResetToken: null,
      passwordResetExpiry: null,
    });

    const ctx = createPublicCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.login({ email: "user@example.com", password: "wrongpassword" })
    ).rejects.toThrow("Invalid email or password");
  });

  it("throws NOT_FOUND for unknown email", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(undefined);

    const ctx = createPublicCtx();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.auth.login({ email: "nobody@example.com", password: "password" })
    ).rejects.toThrow("Invalid email or password");
  });
});

describe("auth.requestPasswordReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns success even for unknown email (no enumeration)", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(undefined);

    const ctx = createPublicCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.requestPasswordReset({ email: "nobody@example.com" });
    expect(result.success).toBe(true);
  });

  it("generates a reset token for known email", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 4,
      openId: "email:known@example.com",
      name: "Known",
      email: "known@example.com",
      passwordHash: "hash",
      loginMethod: "email",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      passwordResetToken: null,
      passwordResetExpiry: null,
    });
    vi.mocked(db.setPasswordResetToken).mockResolvedValue(undefined);

    const ctx = createPublicCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.requestPasswordReset({ email: "known@example.com" });
    expect(result.success).toBe(true);
    expect(result.resetToken).toBeTruthy();
  });
});

describe("auth.logout", () => {
  it("clears the session cookie", async () => {
    const clearedCookies: string[] = [];
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string) => clearedCookies.push(name),
      } as unknown as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies.length).toBeGreaterThan(0);
  });
});
