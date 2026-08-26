/**
 * VRGTrack API — Cloudflare Pages Functions + D1.
 *
 * Deploys automatically with the Pages project. On first request it creates
 * its tables and seeds the real snapshot (through Aug 19, 2026) if the
 * database is empty, so no migration tooling is needed.
 *
 * Required bindings on the Pages project:
 *   DB              — D1 database binding
 *   ADMIN_PASSWORD  — environment variable/secret; the dashboard password
 */
import seedData from "./seedData.json";

interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const ok = (data: unknown) => json({ ok: true, data });
const err = (message: string, status = 400) => json({ ok: false, error: message }, status);

function parseJsonSafe<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function totalsFor(rows: SubmissionRow[]) {
  let referrals = 0;
  let oneToOnes = 0;
  let money = 0;
  let visitors = 0;
  for (const s of rows) {
    referrals += parseJsonSafe<{ count: number }[]>(s.referrals, []).reduce(
      (a, r) => a + (Number(r.count) || 0),
      0
    );
    oneToOnes += parseJsonSafe<number[]>(s.oneToOnes, []).length;
    money += parseJsonSafe<{ amount: number }[]>(s.moneyReceived, []).reduce(
      (a, m) => a + (Number(m.amount) || 0),
      0
    );
    visitors += s.visitorsCount || 0;
  }
  return { referrals, oneToOnes, money, visitors };
}

type SubmissionRow = {
  id: number;
  memberId: number;
  meetingDate: string;
  attended: number;
  absenceReason: string | null;
  visitorsCount: number;
  referrals: string | null;
  oneToOnes: string | null;
  moneyReceived: string | null;
  createdAt: string;
};

// ─── Auth: HMAC token derived from the admin password ─────────────────────────

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`vrgtrack:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function issueToken(secret: string): Promise<string> {
  const exp = Date.now() + TOKEN_TTL_MS;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(exp)));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${exp}.${hex}`;
}

async function verifyToken(token: string | null, secret: string): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = Number(token.slice(0, dot));
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const sigHex = token.slice(dot + 1);
  if (sigHex.length !== 64 || /[^0-9a-f]/.test(sigHex)) return false;
  const sig = new Uint8Array(sigHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const key = await hmacKey(secret);
  return crypto.subtle.verify("HMAC", key, sig, new TextEncoder().encode(String(exp)));
}

function bearer(request: Request): string | null {
  const h = request.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

// ─── Schema bootstrap + one-time seed ─────────────────────────────────────────

let readyPromise: Promise<void> | null = null;

async function ensureReady(env: Env) {
  readyPromise ??= (async () => {
    await env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memberId INTEGER NOT NULL,
        meetingDate TEXT NOT NULL,
        attended INTEGER NOT NULL DEFAULT 1,
        absenceReason TEXT,
        visitorsCount INTEGER NOT NULL DEFAULT 0,
        referrals TEXT,
        oneToOnes TEXT,
        moneyReceived TEXT,
        createdAt TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL UNIQUE,
        referrals INTEGER NOT NULL DEFAULT 0,
        oneToOnes INTEGER NOT NULL DEFAULT 0,
        money REAL NOT NULL DEFAULT 0,
        visitors INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_submissions_date ON submissions (meetingDate)`),
      env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_submissions_member ON submissions (memberId)`),
    ]);

    const row = await env.DB.prepare("SELECT COUNT(*) AS c FROM members").first<{ c: number }>();
    if ((row?.c ?? 0) > 0) return;

    // Empty database: load the snapshot of the group's real numbers.
    const now = new Date().toISOString();
    const stmts: D1PreparedStatement[] = [];
    for (const m of seedData.members) {
      stmts.push(
        env.DB.prepare(
          "INSERT INTO members (id, name, email, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(m.id, m.name, m.email, m.active, m.createdAt, m.createdAt)
      );
    }
    for (const g of seedData.goals) {
      stmts.push(
        env.DB.prepare(
          "INSERT INTO goals (year, referrals, oneToOnes, money, visitors, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(g.year, g.referrals, g.oneToOnes, g.money, g.visitors, now, now)
      );
    }
    for (const s of seedData.submissions) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO submissions
            (memberId, meetingDate, attended, absenceReason, visitorsCount, referrals, oneToOnes, moneyReceived, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          s.memberId,
          s.meetingDate,
          s.attended,
          s.absenceReason,
          s.visitorsCount,
          s.referrals,
          s.oneToOnes,
          s.moneyReceived,
          s.createdAt
        )
      );
    }
    // D1 batches are limited in size; chunk to stay well under it.
    for (let i = 0; i < stmts.length; i += 50) {
      await env.DB.batch(stmts.slice(i, i + 50));
    }
  })();
  try {
    await readyPromise;
  } catch (e) {
    readyPromise = null; // allow retry on the next request
    throw e;
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

async function submissionsBetween(env: Env, fromISO: string, toISO: string) {
  const r = await env.DB.prepare(
    "SELECT * FROM submissions WHERE meetingDate >= ? AND meetingDate <= ? ORDER BY meetingDate DESC, id DESC"
  )
    .bind(fromISO, toISO)
    .all<SubmissionRow>();
  return r.results;
}

async function allMembers(env: Env) {
  const r = await env.DB.prepare("SELECT * FROM members ORDER BY name").all();
  return r.results;
}

async function goalsForYear(env: Env, year: number) {
  return env.DB.prepare("SELECT * FROM goals WHERE year = ?").bind(year).first();
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return new Response(null, { status: 204 });

  if (!env.DB) return err("D1 binding 'DB' is not configured on the Pages project.", 500);
  if (!env.ADMIN_PASSWORD) return err("ADMIN_PASSWORD is not configured on the Pages project.", 500);

  try {
    await ensureReady(env);

    // ── Public ────────────────────────────────────────────────────────────
    if (path === "login" && method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { password?: string };
      if (typeof body.password !== "string" || body.password !== env.ADMIN_PASSWORD) {
        return err("Incorrect password.", 401);
      }
      return ok({ token: await issueToken(env.ADMIN_PASSWORD) });
    }

    if (path === "members" && method === "GET") {
      const r = await env.DB.prepare(
        "SELECT id, name, email, active, createdAt, updatedAt FROM members WHERE active = 1 ORDER BY name"
      ).all();
      return ok(r.results);
    }

    if (path === "summary" && method === "GET") {
      const now = new Date();
      const year = now.getFullYear();
      const yearFrom = new Date(year, 0, 1).toISOString();
      const yearTo = new Date(year, 11, 31, 23, 59, 59).toISOString();
      const monthFrom = new Date(year, now.getMonth(), 1).toISOString();
      const subs = await submissionsBetween(env, yearFrom, yearTo);
      const monthSubs = subs.filter((s) => s.meetingDate >= monthFrom);
      const goals = await goalsForYear(env, year);
      return ok({
        year,
        monthName: now.toLocaleString("en-US", { month: "long" }),
        ytd: totalsFor(subs),
        month: totalsFor(monthSubs),
        goals,
      });
    }

    if (path === "submissions" && method === "POST") {
      const b = (await request.json().catch(() => null)) as {
        memberId?: number;
        meetingDate?: string;
        attended?: boolean;
        absenceReason?: string | null;
        visitorsCount?: number;
        referrals?: { toMemberId: number; count: number }[];
        oneToOnes?: number[];
        moneyReceived?: { fromMemberId: number; amount: number }[];
      } | null;
      if (!b || typeof b.memberId !== "number" || typeof b.meetingDate !== "string") {
        return err("memberId and meetingDate are required.");
      }
      const member = await env.DB.prepare("SELECT id FROM members WHERE id = ?").bind(b.memberId).first();
      if (!member) return err("Unknown member.", 404);
      const date = new Date(b.meetingDate);
      if (Number.isNaN(date.getTime())) return err("Invalid meeting date.");

      const referrals = (b.referrals ?? [])
        .map((r) => ({ toMemberId: Number(r.toMemberId), count: Number(r.count) || 0 }))
        .filter((r) => r.toMemberId && r.count > 0);
      const oneToOnes = (b.oneToOnes ?? []).map(Number).filter(Boolean);
      const moneyReceived = (b.moneyReceived ?? [])
        .map((m) => ({ fromMemberId: Number(m.fromMemberId), amount: Number(m.amount) || 0 }))
        .filter((m) => m.fromMemberId && m.amount > 0);

      await env.DB.prepare(
        `INSERT INTO submissions
          (memberId, meetingDate, attended, absenceReason, visitorsCount, referrals, oneToOnes, moneyReceived, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          b.memberId,
          date.toISOString(),
          b.attended === false ? 0 : 1,
          b.attended === false ? (b.absenceReason ?? null) : null,
          Math.max(0, Number(b.visitorsCount) || 0),
          referrals.length ? JSON.stringify(referrals) : null,
          oneToOnes.length ? JSON.stringify(oneToOnes) : null,
          moneyReceived.length ? JSON.stringify(moneyReceived) : null,
          new Date().toISOString()
        )
        .run();
      return ok({ success: true });
    }

    // ── Admin (Bearer token) ──────────────────────────────────────────────
    if (path.startsWith("admin/")) {
      if (!(await verifyToken(bearer(request), env.ADMIN_PASSWORD))) {
        return err("Unauthorized.", 401);
      }
      const sub = path.slice("admin/".length);

      if (sub === "members" && method === "GET") return ok(await allMembers(env));

      if (sub === "members" && method === "POST") {
        const b = (await request.json().catch(() => null)) as { name?: string; email?: string | null } | null;
        if (!b?.name?.trim()) return err("Name is required.");
        const now = new Date().toISOString();
        await env.DB.prepare(
          "INSERT INTO members (name, email, active, createdAt, updatedAt) VALUES (?, ?, 1, ?, ?)"
        )
          .bind(b.name.trim(), b.email || null, now, now)
          .run();
        return ok({ success: true });
      }

      const memberMatch = /^members\/(\d+)$/.exec(sub);
      if (memberMatch && (method === "PUT" || method === "DELETE")) {
        const id = Number(memberMatch[1]);
        if (method === "DELETE") {
          await env.DB.prepare("DELETE FROM members WHERE id = ?").bind(id).run();
          return ok({ success: true });
        }
        const b = (await request.json().catch(() => null)) as {
          name?: string;
          email?: string | null;
          active?: boolean;
        } | null;
        if (!b) return err("Empty body.");
        const existing = await env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(id).first<{
          name: string;
          email: string | null;
          active: number;
        }>();
        if (!existing) return err("Member not found.", 404);
        await env.DB.prepare(
          "UPDATE members SET name = ?, email = ?, active = ?, updatedAt = ? WHERE id = ?"
        )
          .bind(
            b.name !== undefined ? b.name : existing.name,
            b.email !== undefined ? b.email || null : existing.email,
            b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
            new Date().toISOString(),
            id
          )
          .run();
        return ok({ success: true });
      }

      if (sub === "report" && method === "GET") {
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        if (!from || !to) return err("from and to are required.");
        return ok({
          submissions: await submissionsBetween(env, from, to),
          members: await allMembers(env),
        });
      }

      if (sub === "member-report" && method === "GET") {
        const memberId = Number(url.searchParams.get("memberId"));
        if (!memberId) return err("memberId is required.");
        const member = await env.DB.prepare("SELECT * FROM members WHERE id = ?").bind(memberId).first();
        if (!member) return err("Member not found.", 404);
        const subs = await env.DB.prepare(
          "SELECT * FROM submissions WHERE memberId = ? ORDER BY meetingDate DESC, id DESC"
        )
          .bind(memberId)
          .all<SubmissionRow>();
        return ok({ member, submissions: subs.results, members: await allMembers(env) });
      }

      if (sub === "goals" && method === "PUT") {
        const b = (await request.json().catch(() => null)) as {
          year?: number;
          referrals?: number;
          oneToOnes?: number;
          money?: number;
          visitors?: number;
        } | null;
        if (!b || typeof b.year !== "number") return err("year is required.");
        const now = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO goals (year, referrals, oneToOnes, money, visitors, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(year) DO UPDATE SET
             referrals = excluded.referrals,
             oneToOnes = excluded.oneToOnes,
             money = excluded.money,
             visitors = excluded.visitors,
             updatedAt = excluded.updatedAt`
        )
          .bind(
            b.year,
            Math.max(0, Number(b.referrals) || 0),
            Math.max(0, Number(b.oneToOnes) || 0),
            Math.max(0, Number(b.money) || 0),
            Math.max(0, Number(b.visitors) || 0),
            now,
            now
          )
          .run();
        return ok({ success: true });
      }
    }

    return err("Not found.", 404);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Server error.", 500);
  }
};
