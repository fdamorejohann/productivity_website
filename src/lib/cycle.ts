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

// ─── Goals ───────────────────────────────────────────────────────────────────

/** reloadKey: change it to refetch (Home passes the open page so returning Home picks up edits). */
export function useCycleGoals(reloadKey?: unknown) {
  const [goals, setGoals] = useState<CycleGoal[]>([]);
  const [entries, setEntries] = useState<CycleGoalEntry[]>([]);  // list items + weekly measurements, all goals
  const [saved, setSaved] = useState<number | null>(null);    // savings + investing since the cycle began
  const [pipeline, setPipeline] = useState<{ active: number; offers: number } | null>(null);
  const [workouts, setWorkouts] = useState<LoggedWorkout[] | null>(null);
  const [yogaWeeks, setYogaWeeks] = useState<string[] | null>(null);   // Mondays with a Yoga tactic checked off

  useEffect(() => {
    db.sessions.list().then((rows: LoggedWorkout[]) => { if (Array.isArray(rows)) setWorkouts(rows); }).catch(() => {});
    Promise.all([db.cycle.tactics.list(), db.cycle.week.list()]).then(([ts, items]) => {
      if (!Array.isArray(ts) || !Array.isArray(items)) return;
      const yoga = new Set(ts.filter(t => /^yoga/i.test(t.title)).map(t => t.id));
      setYogaWeeks([...new Set(items.filter(i => i.done && yoga.has(i.tactic_id)).map(i => i.week_start))]);
    }).catch(() => {});
    db.cycle.goals.list().then(g => { if (Array.isArray(g)) setGoals(g); }).catch(() => {});
    db.cycle.entries.list().then(e => { if (Array.isArray(e)) setEntries(e); }).catch(() => {});
    const firstMonth = CYCLE.start.slice(0, 7);
    const lastMonth = cycleEnd.slice(0, 7);
    db.summary.list().then((rows: { month: string; category: string; value: number }[]) => {
      if (!Array.isArray(rows)) return;
      setSaved(rows
        .filter(r => r.month >= firstMonth && r.month <= lastMonth && (r.category === "savings" || r.category === "investments"))
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
  const addItem = async (goalId: string, title: string) => {
    const created = await db.cycle.entries.add({ goal_id: goalId, title, done: false, week_start: null, value: null });
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
  cardio_data?: { sets?: number; duration_min?: number } | null;
  workout_sets?: { reps: number | null; exercises?: { name: string } | null }[];
}

// Bodyweight pull-ups / chin-ups; not pull-downs, pullovers, or weighted sets.
const isPullUp = (name: string) => /(pull[\s-]?ups?|chin[\s-]?ups?)/i.test(name) && !/down|over|weighted/i.test(name);
const KB_SETS = 5;

/** Per-week best from logged workouts: kettlebell = fastest time for 5+ sets; pull-ups = most reps in one set. */
export function workoutWeeks(g: CycleGoal, s: GoalsState): { week_start: string; value: number }[] {
  const byWeek = new Map<string, number>();
  for (const w of s.workouts ?? []) {
    let v: number | null = null;
    if (g.auto === "kettlebell" && w.type === "kettlebell" && (w.cardio_data?.sets ?? 0) >= KB_SETS && w.cardio_data?.duration_min) {
      v = w.cardio_data.duration_min;
    }
    if (g.auto === "pullups") {
      const reps = (w.workout_sets ?? []).filter(st => st.exercises?.name && isPullUp(st.exercises.name)).map(st => st.reps ?? 0);
      if (reps.length) v = Math.max(...reps);
    }
    if (v === null || v <= 0) continue;
    const wk = mondayOf(parseYmd(w.date));
    const prev = byWeek.get(wk);
    byWeek.set(wk, prev === undefined ? v : g.lower_is_better ? Math.min(prev, v) : Math.max(prev, v));
  }
  return [...byWeek.entries()].map(([week_start, value]) => ({ week_start, value })).sort((a, b) => a.week_start.localeCompare(b.week_start));
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
  if (g.auto === "kettlebell" || g.auto === "pullups") {
    if (!s.workouts) return { text: "…", pct: null };
    const vals = workoutWeeks(g, s).map(w => w.value);
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
          if (!cancelled && Array.isArray(fresh)) setItems(fresh);
        } else {
          setItems(all);
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
