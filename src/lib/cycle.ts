// src/lib/cycle.ts
// 12 Week Year (Q4 2026): cycle calendar helpers and the data hooks behind Cycle.tsx.

import { useEffect, useState } from "react";
import { db } from "./db";
import type { CycleArea, CycleGoal, CycleGoalEntry, CycleTactic, CycleWeekItem } from "./types";

// ─── Cycle calendar ──────────────────────────────────────────────────────────

export const CYCLE = { name: "Q4", start: "2026-10-05", weeks: 12, target: 0.85 };

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const AREAS: { key: CycleArea; label: string; color: string }[] = [
  { key: "fitness", label: "Fitness", color: "#2a78d6" },
  { key: "money",   label: "Money",   color: "#1baf7a" },
  { key: "work",    label: "Work",    color: "#eb6834" },
  { key: "calm",    label: "Calm",    color: "#e87ba4" },
];
export const areaColor = (a: CycleArea) => AREAS.find(x => x.key === a)!.color;

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}
export function mondayOf(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return ymd(x);
}
/** 1-based week of the cycle for a Monday (can be < 1 or > CYCLE.weeks). */
export function cycleWeek(monday: string): number {
  return Math.round((parseYmd(monday).getTime() - parseYmd(CYCLE.start).getTime()) / (7 * 86_400_000)) + 1;
}
export const shortDate = (s: string) => parseYmd(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const cycleEnd = addDays(CYCLE.start, CYCLE.weeks * 7 - 1);
/** "Save $10K" counts Finances Total (savings + investing + leftover) from this month on — September included on purpose. */
export const SAVINGS_FROM = "2026-09";

// ─── Goals ───────────────────────────────────────────────────────────────────

/** reloadKey: change it to refetch (Home passes the open page so returning Home picks up edits). */
export function useCycleGoals(reloadKey?: unknown) {
  const [goals, setGoals] = useState<CycleGoal[]>([]);
  const [entries, setEntries] = useState<CycleGoalEntry[]>([]);  // list items + weekly measurements, all goals
  const [saved, setSaved] = useState<number | null>(null);    // Finances "Total" (savings + investing + leftover) since SAVINGS_FROM
  const [pipeline, setPipeline] = useState<{ active: number; offers: number } | null>(null);
  const [workouts, setWorkouts] = useState<LoggedWorkout[] | null>(null);
  const [yogaWeeks, setYogaWeeks] = useState<string[] | null>(null);   // Mondays with a Yoga tactic checked off

  useEffect(() => {
    Promise.all([db.sessions.list(), db.cycle.tactics.list(), db.cycle.week.list()]).then(([rows, ts, items]) => {
      if (!Array.isArray(rows) || !Array.isArray(ts) || !Array.isArray(items)) return;
      setWorkouts(rows as LoggedWorkout[]);
      const yoga = new Set(ts.filter(t => /^yoga/i.test(t.title)).map(t => t.id));
      const logged = (rows as LoggedWorkout[]).filter(w => w.type === "yoga" && w.date >= CYCLE.start).map(w => mondayOf(parseYmd(w.date)));
      setYogaWeeks([...new Set([...logged, ...items.filter(i => i.done && yoga.has(i.tactic_id)).map(i => i.week_start)])]);
    }).catch(() => {});
    db.cycle.goals.list().then(g => { if (Array.isArray(g)) setGoals(g); }).catch(() => {});
    db.cycle.entries.list().then(e => { if (Array.isArray(e)) setEntries(e); }).catch(() => {});
    const lastMonth = cycleEnd.slice(0, 7);
    db.summary.list().then((rows: { month: string; category: string; value: number }[]) => {
      if (!Array.isArray(rows)) return;
      // Same months the Total chart uses: skip any month marked "Exclude from charts".
      const excluded = new Set(rows.filter(r => r.category === "excluded" && Number(r.value) === 1).map(r => r.month));
      setSaved(rows
        .filter(r => r.month >= SAVINGS_FROM && r.month <= lastMonth && !excluded.has(r.month)
          && (r.category === "savings" || r.category === "investments" || r.category === "leftover"))
        .reduce((s, r) => s + Number(r.value), 0));
    }).catch(() => {});
    db.jobs.list().then(jobs => {
      if (!Array.isArray(jobs)) return;
      setPipeline({
        active: jobs.filter(j => ["applied", "screen", "interview", "offer"].includes(j.status)).length,
        offers: jobs.filter(j => j.status === "offer").length,
      });
    }).catch(() => {});
  }, [reloadKey]);

  const update = async (id: string, updates: Partial<CycleGoal>) => {
    const prev = goals;
    setGoals(gs => gs.map(g => g.id === id ? { ...g, ...updates } : g));
    try { await db.cycle.goals.update(id, updates); } catch { setGoals(prev); }
  };
  const add = async (goal: Omit<CycleGoal, "id">) => {
    const created = await db.cycle.goals.add(goal);
    if (created?.id) setGoals(gs => [...gs, created]);
  };
  const remove = async (id: string) => {
    setGoals(gs => gs.filter(g => g.id !== id));
    setEntries(es => es.filter(e => e.goal_id !== id));
    await db.cycle.goals.remove(id).catch(() => {});
  };

  // ── Entries: list items and weekly measurements ──
  const addItem = async (goalId: string, title: string, done = false) => {
    const created = await db.cycle.entries.add({ goal_id: goalId, title, done, week_start: null, value: null });
    if (created?.id) setEntries(es => [...es, created]);
  };
  const updateEntry = async (id: string, updates: Partial<CycleGoalEntry>) => {
    const prev = entries;
    setEntries(es => es.map(e => e.id === id ? { ...e, ...updates } : e));
    try { await db.cycle.entries.update(id, updates); } catch { setEntries(prev); }
  };
  const removeEntry = async (id: string) => {
    setEntries(es => es.filter(e => e.id !== id));
    await db.cycle.entries.remove(id).catch(() => {});
  };
  /** One measurement per goal per week: overwrite this week's value, add it, or clear it (null). */
  const logMeasure = async (goalId: string, weekStart: string, value: number | null) => {
    const existing = entries.find(e => e.goal_id === goalId && e.week_start === weekStart);
    if (existing) return value === null ? removeEntry(existing.id) : updateEntry(existing.id, { value });
    if (value === null) return;
    const created = await db.cycle.entries.add({ goal_id: goalId, title: null, done: false, week_start: weekStart, value });
    if (created?.id) setEntries(es => [...es, created]);
  };

  return { goals, entries, saved, pipeline, workouts, yogaWeeks, update, add, remove, addItem, updateEntry, removeEntry, logMeasure };
}

export type GoalsState = ReturnType<typeof useCycleGoals>;

/** A workout as returned by /api/data/sessions (only the fields the goals read). */
export interface LoggedWorkout {
  date: string;
  type: string | null;
  cardio_data?: { sets?: number; duration_min?: number; distance_miles?: number; hold_sec?: number } | null;
  workout_sets?: { reps: number | null; exercises?: { name: string } | null }[];
}

// Bodyweight pull-ups / chin-ups; not pull-downs, pullovers, or weighted sets.
const isPullUp = (name: string) => /(pull[\s-]?ups?|chin[\s-]?ups?)/i.test(name) && !/down|over|weighted/i.test(name);
// L-sit holds only: an "L-sit chin-up" is a chin-up (counts toward pull-ups), not an L-sit hold.
const isLSit = (name: string) => /l[\s-]?sit/i.test(name) && !/chin|pull/i.test(name);
const KB_SETS = 5;

/** Kettlebell session score 0–1 toward "5 sets in <target> min": share of the 5 sets done × pace toward the target
 *  (time scaled to 5 sets). More sets or a faster time always scores higher; 5 sets in 50 min = 0.7, in 35 = 1. */
export function kettlebellScore(w: LoggedWorkout, targetMin: number): number | null {
  const sets = w.cardio_data?.sets ?? 0;
  const mins = w.cardio_data?.duration_min ?? 0;
  if (w.type !== "kettlebell" || sets <= 0 || mins <= 0) return null;
  const paceFor5 = (mins * KB_SETS) / sets;
  return Math.min(1, sets / KB_SETS) * Math.min(1, targetMin / paceFor5);
}
const kbLabel = (w: LoggedWorkout) => `${w.cardio_data!.sets} sets · ${w.cardio_data!.duration_min} min`;

/** Per-week best from logged workouts (all time): kettlebell = best-scoring session; pull-ups = most reps in one set;
 *  run = longest run in miles; L-sit = longest hold (L-sit workouts, or seconds logged as reps on the L-sit exercise).
 *  Goal progress only counts weeks from the cycle start (see cycleWorkoutWeeks). */
export function workoutWeeks(g: CycleGoal, s: GoalsState): { week_start: string; value: number; label?: string }[] {
  const byWeek = new Map<string, { value: number; label?: string }>();
  for (const w of s.workouts ?? []) {
    let v: number | null = null;
    let label: string | undefined;
    if (g.auto === "kettlebell") {
      v = kettlebellScore(w, g.target ?? 35);
      if (v !== null) label = kbLabel(w);
    }
    if (g.auto === "run" && w.type === "running" && w.cardio_data?.distance_miles) {
      v = w.cardio_data.distance_miles;
    }
    if (g.auto === "pullups" || g.auto === "lsit") {
      const match = g.auto === "pullups" ? isPullUp : isLSit;
      const reps = (w.workout_sets ?? []).filter(st => st.exercises?.name && match(st.exercises.name)).map(st => st.reps ?? 0);
      if (g.auto === "lsit" && w.type === "lsit" && w.cardio_data?.hold_sec) reps.push(w.cardio_data.hold_sec);
      if (reps.length) v = Math.max(...reps);
    }
    if (v === null || v <= 0) continue;
    const wk = mondayOf(parseYmd(w.date));
    const prev = byWeek.get(wk);
    // Kettlebell values are scores (higher = better) even though the goal's unit is minutes.
    const better = g.auto !== "kettlebell" && g.lower_is_better ? v < (prev?.value ?? Infinity) : v > (prev?.value ?? -Infinity);
    if (better) byWeek.set(wk, { value: v, label });
  }
  return [...byWeek.entries()].map(([week_start, b]) => ({ week_start, ...b })).sort((a, b) => a.week_start.localeCompare(b.week_start));
}

export const isWorkoutGoal = (g: CycleGoal) => g.auto === "kettlebell" || g.auto === "pullups" || g.auto === "run" || g.auto === "lsit";

/** Workout weeks inside the cycle, and the best result from before it (a starting point). */
export function cycleWorkoutWeeks(g: CycleGoal, s: GoalsState) {
  const all = workoutWeeks(g, s);
  const before = all.filter(w => w.week_start < CYCLE.start);
  const lowerWins = g.lower_is_better && g.auto !== "kettlebell";
  const prior = before.reduce<typeof before[number] | null>((b, w) => !b || (lowerWins ? w.value < b.value : w.value > b.value) ? w : b, null);
  return {
    weeks: all.filter(w => w.week_start >= CYCLE.start),
    priorBest: prior ? (prior.label ?? prior.value) : null,
  };
}

export const listItems = (g: CycleGoal, s: GoalsState) => s.entries.filter(e => e.goal_id === g.id && e.title !== null);
export const measurements = (g: CycleGoal, s: GoalsState) =>
  s.entries.filter(e => e.goal_id === g.id && e.week_start !== null && e.value !== null)
    .sort((a, b) => a.week_start!.localeCompare(b.week_start!));

/** Current value, display text, and 0–1 completion for a goal. */
export function goalStatus(g: CycleGoal, s: GoalsState): { text: string; pct: number | null } {
  const num = (v: number) => (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1));
  const unit = g.unit ? ` ${g.unit}` : "";
  if (g.auto === "savings") {
    if (s.saved === null) return { text: "…", pct: null };
    return { text: `$${Math.round(s.saved).toLocaleString()} of $${(g.target ?? 0).toLocaleString()}`, pct: g.target ? s.saved / g.target : null };
  }
  if (g.auto === "jobs") {
    if (!s.pipeline) return { text: "…", pct: null };
    return s.pipeline.offers > 0
      ? { text: `${s.pipeline.offers} offer${s.pipeline.offers > 1 ? "s" : ""}`, pct: 1 }
      : { text: `${s.pipeline.active} in pipeline`, pct: 0 };
  }
  if (g.auto === "yoga") {
    if (!s.yogaWeeks) return { text: "…", pct: null };
    return { text: `${s.yogaWeeks.length} / ${num(g.target ?? 0)}${unit}`, pct: g.target ? Math.min(1, s.yogaWeeks.length / g.target) : null };
  }
  if (isWorkoutGoal(g)) {
    if (!s.workouts) return { text: "…", pct: null };
    const weeks = cycleWorkoutWeeks(g, s).weeks;
    if (g.auto === "kettlebell") {
      // Best session by score; 5+ sets reads as "50 min → 35", fewer as "4 sets · 30 min".
      const best = (s.workouts ?? []).filter(w => w.date >= CYCLE.start)
        .map(w => ({ w, score: kettlebellScore(w, g.target ?? 35) }))
        .filter((x): x is { w: LoggedWorkout; score: number } => x.score !== null)
        .sort((a, b) => b.score - a.score)[0];
      if (!best) return { text: `goal ${num(g.target ?? 0)}${unit}`, pct: 0 };
      const { sets, duration_min } = best.w.cardio_data!;
      return {
        text: (sets ?? 0) >= KB_SETS ? `${num(duration_min!)} min → ${num(g.target ?? 0)}` : kbLabel(best.w),
        pct: best.score,
      };
    }
    const vals = weeks.map(w => w.value);
    if (vals.length === 0) return { text: `goal ${num(g.target ?? 0)}${unit}`, pct: 0 };
    const best = g.lower_is_better ? Math.min(...vals) : Math.max(...vals);
    return g.lower_is_better
      ? { text: `${num(best)}${unit} → ${num(g.target ?? 0)}`, pct: g.target ? Math.min(1, g.target / best) : null }
      : { text: `${num(best)} / ${num(g.target ?? 0)}${unit}`, pct: g.target ? Math.min(1, best / g.target) : null };
  }
  if (g.mode === "list") {
    const items = listItems(g, s);
    const done = items.filter(i => i.done).length;
    if (g.target === null) return { text: `${done}/${items.length}${unit}`, pct: items.length ? done / items.length : 0 };
    return { text: `${done} / ${num(g.target)}${unit}`, pct: Math.min(1, done / g.target) };
  }
  let value = g.progress;
  if (g.mode === "measure") {
    const vals = measurements(g, s).map(m => m.value!);
    value = vals.length === 0 ? null : g.use_latest ? vals[vals.length - 1] : g.lower_is_better ? Math.min(...vals) : Math.max(...vals);
  }
  if (value === null || value === undefined) return { text: `goal ${num(g.target ?? 0)}${unit}`, pct: 0 };
  if (g.lower_is_better) {
    return { text: `${num(value)}${unit} → ${num(g.target ?? 0)}`, pct: g.target ? Math.min(1, g.target / value) : null };
  }
  return { text: `${num(value)} / ${num(g.target ?? 0)}${unit}`, pct: g.target ? Math.min(1, value / g.target) : null };
}

// ─── Weekly tactics ──────────────────────────────────────────────────────────

// Logged workouts check off this week's fitness tactics: lifting → Gym, kettlebell → Kettlebell,
// running / biking → Cardio, yoga → Yoga. One-way: unchecking by hand is undone on the next load.
const TACTIC_FOR_WORKOUT: { tactic: RegExp; types: string[] }[] = [
  { tactic: /^gym/i, types: ["lifting"] },
  { tactic: /^kettlebell/i, types: ["kettlebell"] },
  { tactic: /^cardio/i, types: ["running", "biking"] },
  { tactic: /^yoga/i, types: ["yoga"] },
];

async function checkOffFromWorkouts(monday: string, tactics: CycleTactic[], items: CycleWeekItem[]): Promise<boolean> {
  const sunday = addDays(monday, 6);
  const sessions = await db.sessions.list().catch(() => []) as LoggedWorkout[];
  const week = Array.isArray(sessions) ? sessions.filter(w => w.date >= monday && w.date <= sunday) : [];
  const patches: Promise<unknown>[] = [];
  for (const rule of TACTIC_FOR_WORKOUT) {
    const logged = week.filter(w => rule.types.includes(w.type ?? "")).sort((a, b) => a.date.localeCompare(b.date));
    const slots = items.filter(i => i.week_start === monday && rule.tactic.test(tactics.find(t => t.id === i.tactic_id)?.title ?? ""));
    const open = slots.filter(i => !i.done);
    // Workouts already covered by a checked-off slot need nothing; each remaining one takes the open slot on
    // its weekday if there is one, else the first open slot, which then moves to the day you trained.
    for (const w of logged.slice(slots.length - open.length)) {
      if (open.length === 0) break;
      const weekday = (parseYmd(w.date).getDay() + 6) % 7;
      const k = Math.max(0, open.findIndex(i => i.day === weekday));
      const [slot] = open.splice(k, 1);
      patches.push(db.cycle.week.update(slot.id, { done: true, day: weekday }));
    }
  }
  await Promise.all(patches);
  return patches.length > 0;
}

export function useCycleWeek(reloadKey?: unknown) {
  const monday = mondayOf();
  const week = cycleWeek(monday);
  const inCycle = week >= 1 && week <= CYCLE.weeks;
  const [tactics, setTactics] = useState<CycleTactic[]>([]);
  const [items, setItems] = useState<CycleWeekItem[]>([]);   // every week's items (scorecard history)
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ts, all] = await Promise.all([db.cycle.tactics.list(), db.cycle.week.list()]);
        if (cancelled || !Array.isArray(ts) || !Array.isArray(all)) return;
        setTactics(ts);
        // New week (or newly added tactics): put every active tactic on this week, fixed days placed, the rest in the tray.
        const missing = inCycle ? ts.filter(t => t.active && !all.some(i => i.week_start === monday && i.tactic_id === t.id)) : [];
        if (missing.length > 0) {
          await db.cycle.week.add(missing.map(t => ({ week_start: monday, tactic_id: t.id, day: t.default_day, done: false })));
          let fresh = await db.cycle.week.list();
          // Make sure the items just created for fixed-day tactics landed on their day.
          const unplaced = Array.isArray(fresh) ? fresh.filter(i => i.week_start === monday && i.day === null && !i.done
            && missing.some(t => t.id === i.tactic_id && t.default_day !== null)) : [];
          if (unplaced.length > 0) {
            await Promise.all(unplaced.map(i => db.cycle.week.update(i.id, { day: missing.find(t => t.id === i.tactic_id)!.default_day })));
            fresh = await db.cycle.week.list();
          }
          if (Array.isArray(fresh) && inCycle && await checkOffFromWorkouts(monday, ts, fresh)) fresh = await db.cycle.week.list();
          if (!cancelled && Array.isArray(fresh)) setItems(fresh);
        } else {
          const updated = inCycle && await checkOffFromWorkouts(monday, ts, all) ? await db.cycle.week.list() : all;
          if (!cancelled && Array.isArray(updated)) setItems(updated);
        }
      } catch { /* leave empty */ } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [monday, inCycle, reloadKey]);

  const patch = async (id: string, updates: Partial<CycleWeekItem>) => {
    const prev = items;
    setItems(is => is.map(i => i.id === id ? { ...i, ...updates } : i));
    try { await db.cycle.week.update(id, updates); } catch { setItems(prev); }
  };

  const thisWeek = items.filter(i => i.week_start === monday);
  const score = (list: CycleWeekItem[]) => list.length ? list.filter(i => i.done).length / list.length : null;
  const history = Array.from({ length: CYCLE.weeks }, (_, k) => {
    const start = addDays(CYCLE.start, k * 7);
    return { week: k + 1, start, score: score(items.filter(i => i.week_start === start)) };
  });

  return { monday, week, inCycle, tactics, setTactics, thisWeek, score: score(thisWeek), history, loaded, patch };
}

export type WeekState = ReturnType<typeof useCycleWeek>;
