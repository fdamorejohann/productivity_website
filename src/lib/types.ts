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

// ─── 12 Week Year cycle (public.cycle_goals / cycle_tactics / cycle_week_items) ─

export type CycleArea = "fitness" | "money" | "work" | "calm";

export interface CycleGoal {
  id: string;
  area: CycleArea;
  title: string;
  target: number | null;
  progress: number | null;        // manual progress; ignored when `auto` is set
  unit: string | null;
  lower_is_better: boolean;       // e.g. minutes for the KB routine, screen-time hours
  // computed instead of `progress`: Finances savings, Jobs pipeline, logged kettlebell / pull-up / running / L-sit workouts, weeks with yoga logged or checked off
  auto: "savings" | "jobs" | "kettlebell" | "pullups" | "run" | "lsit" | "yoga" | "lift" | null;
  mode: "count" | "list" | "measure" | "auto"; // +/- counter, checklist of items, number logged weekly, or computed
  use_latest: boolean;            // measure: progress is the latest week, not the best
  exercise: string | null;        // auto 'lift': exercises.name it tracks
  target_weight: number | null;   // auto 'lift': lb for weighted goals (target = reps at that weight); null = reps only
  sort: number;
}

/** A list item (title + done) or a weekly measurement (week_start + value) for a goal. */
export interface CycleGoalEntry {
  id: string;
  goal_id: string;
  title: string | null;
  done: boolean;
  week_start: string | null;
  value: number | null;
}

export interface CycleTactic {
  id: string;
  area: CycleArea;
  title: string;
  default_day: number | null;     // 0 = Monday; null = lands in the tray each week
  active: boolean;
  sort: number;
}

export interface CycleWeekItem {
  id: string;
  week_start: string;             // Monday, YYYY-MM-DD
  tactic_id: string;
  day: number | null;             // null = in the tray
  done: boolean;
}

// ─── NYC events (public.nyc_events) ──────────────────────────────────────────

export type NycEventStatus = "new" | "interested" | "not_interested" | "went";

export interface NycEvent {
  id: string;
  title: string;
  kind: "theater" | "music" | "comedy" | "dance" | "museum" | "gallery" | "film" | "talk" | "other";
  venue: string | null;
  neighborhood: string | null;
  starts_on: string | null;
  ends_on: string | null;
  price: string | null;
  url: string;
  description: string | null;
  why: string | null;
  tags: string[];
  status: NycEventStatus;
  status_changed_at: string | null;
  found_at: string;
}

// ─── Movies (public.movies) ──────────────────────────────────────────────────

export interface Movie {
  id: string;
  slug: string;                 // letterboxd.com/film/<slug>/
  title: string;
  year: number | null;
  on_watchlist: boolean;
  watched: boolean;
  watched_on: string | null;
  pick_status: "new" | "interested" | "not_interested" | null;  // set only on Claude's picks
  why: string | null;
  tags: string[];
  source: "letterboxd" | "claude" | "site";
  synced_at: string | null;
  // Playing in NYC now or within ~a month (filled by the movie-sync-picks task)
  showing_where: string | null;
  showing_url: string | null;
  showing_from: string | null;
  showing_until: string | null;
  showing_checked_at: string | null;
}

// ─── Albums (public.albums) ──────────────────────────────────────────────────

export type AlbumStatus = "new" | "liked" | "meh" | "disliked" | "skipped";

export interface Album {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  genre: string | null;
  category: string | null;      // music-type tab key (free text; labels in Albums.tsx); taste_check = calibration strip
  kind: "artist" | "album";     // artist = rate the artist (title = album to start with); album = rate this record (canon)
  apple_url: string | null;
  spotify_url: string | null;
  artwork_url: string | null;
  why: string | null;
  tags: string[];
  source: "claude" | "seed" | "site";
  status: AlbumStatus;
  feedback: string | null;
  liked_songs: string | null;   // Finn's free text; /api/spotify/sync adds them to the new_songs playlist
  songs_added: string[];        // song names already synced to Spotify
  this_is_url: string | null;   // Spotify "This Is <artist>" playlist, when one exists
  reacted_at: string | null;
  created_at: string;
}

// ─── Notes (public.notes) ────────────────────────────────────────────────────

export interface NotePage {
  id: number;      // 1 = the original note
  title: string;
  content: string | null;
  sort: number;
}
