import { useSyncExternalStore } from "react";
import { buildSeedState, SEED_VERSION } from "./seed";
import type { DemoState } from "./types";

const STORAGE_KEY = "vrgtrack-demo-state";

const DATE_FIELDS = ["createdAt", "updatedAt", "lastSignedIn", "meetingDate"] as const;

function reviveDates<T>(rows: T[]): T[] {
  for (const row of rows) {
    for (const field of DATE_FIELDS) {
      const value = (row as Record<string, unknown>)[field];
      if (typeof value === "string") (row as Record<string, unknown>)[field] = new Date(value);
    }
  }
  return rows;
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      // The dataset is a fixed snapshot (through Aug 19, 2026), so only the
      // seed version matters — no re-seeding on a calendar-year rollover.
      if (parsed.seedVersion === SEED_VERSION) {
        reviveDates(parsed.members);
        reviveDates(parsed.submissions);
        reviveDates(parsed.goals);
        reviveDates(parsed.users);
        return parsed;
      }
    }
  } catch {
    // Corrupt or unavailable storage just falls through to a fresh seed.
  }
  const seeded = buildSeedState();
  save(seeded);
  return seeded;
}

function save(next: DemoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private-browsing quota errors are non-fatal: the demo still works in memory.
  }
}

let state: DemoState = load();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  for (const listener of listeners) listener();
}

export function getState(): DemoState {
  return state;
}

/** Apply a mutation to the demo dataset, persist it, and re-run every live query. */
export function mutate(fn: (draft: DemoState) => void) {
  fn(state);
  save(state);
  emit();
}

/** Force every live query to re-resolve without changing data (invalidate). */
export function bump() {
  emit();
}

/** Throw away local edits and rebuild the seeded dataset. */
export function resetDemoData() {
  state = buildSeedState();
  save(state);
  emit();
}

export function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getVersion = () => version;

/** Re-renders a component whenever the demo dataset changes. */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}
