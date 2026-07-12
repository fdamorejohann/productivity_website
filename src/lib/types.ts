/**
 * types.ts — all shared TypeScript types for the app.
 *
 * Every data structure that gets persisted or passed between components
 * is defined here. Keep this file free of business logic — pure types only,
 * except for goalUnitLabel() which is tightly coupled to the Goal shape.
 */

// ─── Tracking mode ───────────────────────────────────────────────────────────

/**
 * How a goal measures progress:
 *   frequency  — counts discrete sessions ("workout 3 times a week")
 *   cumulative — accumulates a total amount ("read 2 hours a week")
 */
export type TrackingMode = "frequency" | "cumulative";

/** Units available for cumulative goals. */
export type AmountUnit = "minutes" | "hours" | "pages" | "dollars" | "custom";

/** Units for the optional per-session duration on frequency goals. */
export type DurationUnit = "minutes" | "hours";

// ─── Core data shapes ─────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  name: string;
  description: string;       // "" when not set — always present so forms are controlled
  trackingMode: TrackingMode;

  /**
   * Meaning depends on trackingMode:
   *   frequency  → number of sessions per week (integer)
   *   cumulative → total amount per week (decimal OK, e.g. 2.5 hours)
   */
  target: number;

  // Cumulative-only fields
  amountUnit: AmountUnit;
  customUnitLabel: string;   // only used when amountUnit === "custom"; "" otherwise

  // Frequency-only fields
  sessionDuration: number;           // 0 means "not set" — informational, not tracked numerically
  sessionDurationUnit: DurationUnit;

  color: string;       // hex string, e.g. "#3b82f6"
  active: boolean;     // inactive goals are hidden from dashboard and planner
  createdAt: string;   // ISO datetime string
}

export interface PlannedTask {
  id: string;
  goalId: string;
  date: string;         // YYYY-MM-DD — which day this task is scheduled for
  amount: number;       // always 1 currently; reserved for future "log N at once"
  createdAt?: string;   // ISO datetime — when this plan was actually created (retroactive vs. advance)

  /**
   * Whether the user has marked this task done.
   * When set to true, a CompletionLog is created and its ID stored in logId.
   * When toggled back to false, that specific log is removed via logId.
   */
  completed: boolean;
  logId?: string;       // ID of the CompletionLog linked to this task's completion
}

export interface CompletionLog {
  id: string;
  goalId: string;
  date: string;   // YYYY-MM-DD — when the work was done
  /**
   * How much was logged:
   *   frequency goals  → always 1 (one session)
   *   cumulative goals → decimal amount (e.g. 0.5 hours, 30 pages)
   */
  value: number;
}

// ─── Food Cost Tracker ────────────────────────────────────────────────────────

export interface GroceryHaul {
  id: string;
  store: string;
  amount: number;
  date: string;       // YYYY-MM-DD
  notes: string;
  created_at: string;
}

export interface Meal {
  id: string;
  name: string;
  date: string;       // YYYY-MM-DD
  created_at: string;
}

// ─── Trip Cost Tracker (England & Dublin) ─────────────────────────────────────

export interface TripExpense {
  id: string;
  description: string;
  amount: number;
  date: string;       // YYYY-MM-DD
  created_at: string;
}

// ─── UI state ─────────────────────────────────────────────────────────────────

/** The four top-level views controlled by the sidebar nav. */
export type View = "dashboard" | "planner" | "analytics" | "budget";

/** Computed progress for one goal in one week, returned by getGoalProgress(). */
export interface GoalProgress {
  goal: Goal;
  completed: number;    // sum of CompletionLog.value for this goal in this week
  percentage: number;   // 0–100, capped at 100
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the human-readable unit label for displaying a goal's progress.
 * Examples: "sessions", "hours", "pages", "miles" (custom)
 */
export function goalUnitLabel(goal: Goal): string {
  if (goal.trackingMode === "frequency") return "sessions";
  if (goal.amountUnit === "custom") return goal.customUnitLabel || "units";
  return goal.amountUnit;
}
