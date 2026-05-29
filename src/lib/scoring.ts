/**
 * scoring.ts — all score calculation logic.
 *
 * These functions are pure: they take goals + logs + a date and return numbers.
 * No state, no side-effects. Easy to unit-test in isolation.
 *
 * Scoring model:
 *   - Each active goal contributes 0–100% (capped) based on completed / target
 *   - Weekly score = average of all active goal percentages (0–100, integer)
 *   - "Completed" = sum of CompletionLog.value for that goal in that week's date range
 *   - CompletionLogs created from the dashboard OR from the planner both count equally
 */

import type { Goal, CompletionLog, GoalProgress } from "./types";
import { currentWeekKeys, toDateString, weeksInMonth } from "./date";

// ─── Per-goal ─────────────────────────────────────────────────────────────────

/**
 * Returns the progress for a single goal in the week starting at `weekStart`.
 *
 * completed = sum of all log values for this goal whose date falls in Mon–Sun
 * percentage = min(100, completed / target * 100)
 */
export function getGoalProgress(
  goal: Goal,
  logs: CompletionLog[],
  weekStart: Date
): GoalProgress {
  const keys = new Set(currentWeekKeys(weekStart));
  const completed = logs
    .filter((l) => l.goalId === goal.id && keys.has(l.date))
    .reduce((sum, l) => sum + l.value, 0);
  const percentage =
    goal.target > 0 ? Math.min(100, (completed / goal.target) * 100) : 0;
  return { goal, completed, percentage };
}

// ─── Weekly score ─────────────────────────────────────────────────────────────

/**
 * Returns the overall week score (0–100) as a rounded integer.
 * Score = average of each active goal's percentage.
 * Inactive goals are excluded from the average entirely.
 */
export function getWeekScore(
  goals: Goal[],
  logs: CompletionLog[],
  weekStart: Date
): number {
  const active = goals.filter((g) => g.active);
  if (active.length === 0) return 0;
  const total = active.reduce(
    (sum, g) => sum + getGoalProgress(g, logs, weekStart).percentage,
    0
  );
  return Math.round(total / active.length);
}

// ─── Monthly average ──────────────────────────────────────────────────────────

/**
 * Returns the average week score for all weeks in the month containing `date`.
 * Only includes weeks that have already started (no future weeks).
 */
export function getMonthAverage(
  goals: Goal[],
  logs: CompletionLog[],
  date: Date
): number {
  const year = date.getFullYear();
  const month = date.getMonth();
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Filter to weeks that have already started
  const weeks = weeksInMonth(year, month).filter((w) => w <= now);
  if (weeks.length === 0) return 0;

  const scores = weeks.map((w) => getWeekScore(goals, logs, w));
  return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
}

// ─── Historical data for analytics ───────────────────────────────────────────

/**
 * Returns up to `limit` previous week scores, ending the week before `weekStart`.
 * Weeks with no log activity at all are filtered out to keep the chart clean.
 * Results are sorted oldest → newest.
 */
export function getPreviousWeekScores(
  goals: Goal[],
  logs: CompletionLog[],
  weekStart: Date,
  limit = 8
): Array<{ weekStart: string; score: number }> {
  const results: Array<{ weekStart: string; score: number }> = [];
  let w = new Date(weekStart);

  for (let i = 0; i < limit; i++) {
    w = new Date(w);
    w.setDate(w.getDate() - 7);
    const score = getWeekScore(goals, logs, w);
    results.unshift({ weekStart: toDateString(w), score });
  }

  // Only include weeks where at least one log exists in or adjacent to that week
  const logDates = new Set(logs.map((l) => l.date.slice(0, 7))); // YYYY-MM set
  return results.filter((r) => {
    const ym = r.weekStart.slice(0, 7);
    const weekEndYm = toDateString(
      new Date(new Date(r.weekStart + "T00:00:00").getTime() + 6 * 86400000)
    ).slice(0, 7);
    return logDates.has(ym) || logDates.has(weekEndYm);
  });
}

/**
 * Returns `weeks` weeks of per-goal history ending the week before `weekStart`.
 * Used by AnalyticsPanel to render the per-goal mini bar charts.
 */
export function getGoalHistory(
  goal: Goal,
  logs: CompletionLog[],
  weekStart: Date,
  weeks = 8
): Array<{ weekStart: string; completed: number; percentage: number }> {
  const results = [];
  let w = new Date(weekStart);

  for (let i = 0; i < weeks; i++) {
    w = new Date(w);
    w.setDate(w.getDate() - 7);
    const { completed, percentage } = getGoalProgress(goal, logs, w);
    results.unshift({ weekStart: toDateString(w), completed, percentage });
  }

  return results;
}

/**
 * Returns `totalWeeks` entries including the current week and past weeks,
 * oldest first, with an `isCurrent` flag on the current week's entry.
 * Used by AnalyticsPanel's weekly score chart.
 */
export function getCurrentAndPastScores(
  goals: Goal[],
  logs: CompletionLog[],
  weekStart: Date,
  totalWeeks = 8
): Array<{ weekStart: string; score: number; isCurrent: boolean }> {
  const past = getPreviousWeekScores(goals, logs, weekStart, totalWeeks - 1);
  const current = {
    weekStart: toDateString(weekStart),
    score: getWeekScore(goals, logs, weekStart),
    isCurrent: true,
  };
  return [
    ...past.map((p) => ({ ...p, isCurrent: false })),
    current,
  ];
}
