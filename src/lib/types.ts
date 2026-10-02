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
  amount: number;     // £ paid; 0 when paid with points
  points: number;     // points paid; 0 when paid with £
  date: string;       // YYYY-MM-DD
  created_at: string;
}

// ─── Job Postings (Jobs panel) ────────────────────────────────────────────────

export type JobStatus =
  | "new" | "interested"
  | "applied" | "screen" | "interview" | "offer"          // pipeline
  | "rejected" | "withdrawn" | "skipped" | "closed";      // archive

/** lead = EM / tech lead / staff+, engineer = senior IC, product = PM / TPM / product engineer. */
export type JobCategory = "lead" | "engineer" | "product";

export interface JobFitDetails {
  reasons?: string[];
  red_flags?: string[];
  resume?: string | null;   // suggested resume variant
  [extra: string]: unknown; // scanner may add more (checks, dimensions, …)
}

/** A row from public.job_postings. Manual rows (source = 'manual') may lack description/fit fields. */
export interface JobPosting {
  id: number;
  url: string;              // "manual:<slug>" for manual rows without a link
  source: string;
  source_job_id: string | null;
  company: string;
  title: string;
  location: string | null;
  remote: boolean | null;
  salary: string | null;
  description: string | null;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  closed_at: string | null;
  status: JobStatus;
  category: JobCategory | null; // set from title by DB trigger on insert; editable via PATCH
  status_changed_at: string;   // set by DB trigger — never written by the app
  applied_at: string | null;   // YYYY-MM-DD; trigger fills it on → 'applied' if empty
  notes: string | null;
  why_interested: string | null;
  contact: string | null;
  next_step: string | null;
  follow_up_on: string | null; // YYYY-MM-DD
  fit_score: number | null;    // 1–5; null = not scored
  fit_summary: string | null;
  fit_details: JobFitDetails | null;
  scored_at: string | null;
  updated_at: string;
}

/** Fields the app may PATCH (mirrors the API whitelist). */
export type JobUpdate = Partial<Pick<JobPosting,
  "status" | "category" | "notes" | "why_interested" | "contact" | "next_step" | "follow_up_on" | "applied_at">>;

export interface NewJob {
  url?: string;
  company: string;
  title: string;
  location?: string;
  why_interested?: string;
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
