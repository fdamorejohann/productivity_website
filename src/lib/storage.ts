/**
 * storage.ts — localStorage persistence facade.
 *
 * All reads and writes go through the `storage` object exported at the bottom.
 * To migrate to SQLite later, replace only the internals of this file —
 * no other file needs to change.
 *
 * localStorage keys:
 *   wg_goals            → Goal[]
 *   wg_planned_tasks    → PlannedTask[]
 *   wg_completion_logs  → CompletionLog[]
 *
 * Migration functions run on every read to fill in fields added in later
 * versions, so old stored data is silently upgraded on load.
 */

import type { Goal, PlannedTask, CompletionLog, AmountUnit, TrackingMode, DurationUnit } from "./types";

const KEYS = {
  goals: "wg_goals",
  plans: "wg_planned_tasks",
  logs: "wg_completion_logs",
} as const;

// ─── Generic helpers ──────────────────────────────────────────────────────────

/** Reads a JSON array from localStorage, returning [] on any parse error. */
function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Migration functions ──────────────────────────────────────────────────────

/**
 * Converts a raw Goal from localStorage to the current Goal shape.
 * Handles the pre-trackingMode format where goals had a single `unit` field
 * ("times" | "hours" | "pages" | "dollars" | "custom").
 */
function migrateGoal(raw: Record<string, unknown>): Goal {
  const oldUnit = raw.unit as string | undefined;
  // Old goals with unit="times" (or no unit) were frequency-based
  const wasFrequency = !raw.trackingMode && (!oldUnit || oldUnit === "times");
  return {
    id: raw.id as string,
    name: raw.name as string,
    description: (raw.description as string) ?? "",
    trackingMode: (raw.trackingMode as TrackingMode) ?? (wasFrequency ? "frequency" : "cumulative"),
    target: (raw.target as number) ?? 1,
    amountUnit: (raw.amountUnit as AmountUnit) ?? (wasFrequency ? "hours" : (oldUnit as AmountUnit) ?? "hours"),
    customUnitLabel: (raw.customUnitLabel as string) ?? "",
    sessionDuration: (raw.sessionDuration as number) ?? 0,
    sessionDurationUnit: (raw.sessionDurationUnit as DurationUnit) ?? "minutes",
    color: (raw.color as string) ?? "#3b82f6",
    active: (raw.active as boolean) ?? true,
    createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
  };
}

// ─── Public facade ────────────────────────────────────────────────────────────

export const storage = {
  getGoals: (): Goal[] =>
    load<Record<string, unknown>>(KEYS.goals).map(migrateGoal),
  saveGoals: (goals: Goal[]): void => save(KEYS.goals, goals),

  /** Inline migration fills in `completed` and `logId` for pre-toggle PlannedTasks. */
  getPlannedTasks: (): PlannedTask[] =>
    load<Record<string, unknown>>(KEYS.plans).map((raw) => ({
      id: raw.id as string,
      goalId: raw.goalId as string,
      date: raw.date as string,
      amount: (raw.amount as number) ?? 1,
      completed: (raw.completed as boolean) ?? false,
      logId: raw.logId as string | undefined,
      createdAt: raw.createdAt as string | undefined,
    })),
  savePlannedTasks: (tasks: PlannedTask[]): void => save(KEYS.plans, tasks),

  getCompletionLogs: (): CompletionLog[] => load<CompletionLog>(KEYS.logs),
  saveCompletionLogs: (logs: CompletionLog[]): void => save(KEYS.logs, logs),
};
