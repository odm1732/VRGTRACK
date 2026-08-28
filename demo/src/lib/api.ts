import { useSyncExternalStore } from "react";

/**
 * Fetch layer for the VRGTrack API (Cloudflare Pages Functions + D1).
 * The admin session is a signed token from POST /api/login, kept in
 * localStorage and sent as a Bearer header on admin endpoints.
 */

const TOKEN_KEY = "vrgtrack-admin-token";

// ─── Change bus: queries re-run when data or auth changes ────────────────────

let version = 0;
const listeners = new Set<() => void>();

export function bump() {
  version++;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getVersion = () => version;

export function useDataVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

// ─── Token management ────────────────────────────────────────────────────────

export function getToken(): string | null {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return null;
    const exp = Number(t.slice(0, t.indexOf(".")));
    if (!Number.isFinite(exp) || exp < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return t;
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Session still works in-memory for this page load.
  }
  bump();
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
  bump();
}

export function isAuthed(): boolean {
  return getToken() !== null;
}

export type Session = { role: "admin" } | { role: "member"; memberId: number };

/** Session encoded in the token (exp.role.signature), or null when signed out. */
export function getSession(): Session | null {
  const t = getToken();
  if (!t) return null;
  const role = t.split(".")[1];
  if (role === "admin") return { role: "admin" };
  if (/^m\d+$/.test(role)) return { role: "member", memberId: Number(role.slice(1)) };
  return null;
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const token = getToken();
  if (token) headers["authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api/${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let payload: { ok?: boolean; data?: T; error?: string } | null = null;
  try {
    payload = await res.json();
  } catch {
    // non-JSON error body
  }

  if (res.status === 401 && !path.startsWith("login")) {
    clearToken();
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error ?? `Request failed (${res.status}).`);
  }
  return payload.data as T;
}

// ─── Row types + revival ─────────────────────────────────────────────────────

export type Member = {
  id: number;
  name: string;
  email: string | null;
  active: boolean;
  /** present on the public list; true once the member created their password */
  hasPassword?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Referral = { toMemberId: number; count: number };
export type MoneyReceived = { fromMemberId: number; amount: number };

export type ParsedSubmission = {
  id: number;
  memberId: number;
  meetingDate: Date;
  attended: boolean;
  absenceReason: string | null;
  visitorsCount: number;
  referralsParsed: Referral[];
  oneToOnesParsed: number[];
  moneyReceivedParsed: MoneyReceived[];
  createdAt: Date;
};

type RawMember = Omit<Member, "active" | "hasPassword" | "createdAt" | "updatedAt"> & {
  active: number;
  hasPassword?: number;
  createdAt: string;
  updatedAt: string;
};

type RawSubmission = {
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

function parseJsonSafe<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

export function reviveMember(m: RawMember): Member {
  return {
    ...m,
    active: Boolean(m.active),
    hasPassword: m.hasPassword === undefined ? undefined : Boolean(m.hasPassword),
    createdAt: new Date(m.createdAt),
    updatedAt: new Date(m.updatedAt),
  };
}

export function reviveSubmission(s: RawSubmission): ParsedSubmission {
  return {
    id: s.id,
    memberId: s.memberId,
    meetingDate: new Date(s.meetingDate),
    attended: Boolean(s.attended),
    absenceReason: s.absenceReason,
    visitorsCount: s.visitorsCount,
    referralsParsed: parseJsonSafe<Referral[]>(s.referrals, []),
    oneToOnesParsed: parseJsonSafe<number[]>(s.oneToOnes, []),
    moneyReceivedParsed: parseJsonSafe<MoneyReceived[]>(s.moneyReceived, []),
    createdAt: new Date(s.createdAt),
  };
}

export type RawTypes = { member: RawMember; submission: RawSubmission };

// ─── Meeting agenda ──────────────────────────────────────────────────────────

export type AgendaDoc = {
  meetingInfo: string;
  agendaItems: { time: string; item: string }[];
  officers: { role: string; name: string }[];
  /** date is ISO yyyy-mm-dd; past dates rotate off the public page automatically */
  speakers: { date: string; name: string }[];
  educational: { label: string; name: string }[];
  events: { date: string; time: string; name: string; location: string }[];
};

// ─── Meeting notes ───────────────────────────────────────────────────────────

export type NoteDoc = {
  memberId: number;
  meetingDate: string;
  presentationNotes: string;
  educationalNotes: string;
  /** keyed by the member the note is about (id as string) */
  memberNotes: Record<string, string>;
};

export type RawNoteRow = {
  id: number;
  memberId: number;
  meetingDate: string;
  presentationNotes: string;
  educationalNotes: string;
  memberNotes: string;
  createdAt: string;
  updatedAt: string;
};
