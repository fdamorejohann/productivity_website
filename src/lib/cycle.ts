// src/lib/cycle.ts
// 12 Week Year (Q4 2026): cycle calendar helpers and the data hooks behind Cycle.tsx.

import { useEffect, useState } from "react";
import { db } from "./db";
import type { CycleArea, CycleGoal, CycleTactic, CycleWeekItem } from "./types";

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

export function useCycleGoals() {
  const [goals, setGoals] = useState<CycleGoal[]>([]);
  const [saved, setSaved] = useState<number | null>(null);    // savings + investing since the cycle began
  const [pipeline, setPipeline] = useState<{ active: number; offers: number } | null>(null);

  useEffect(() => {
    db.cycle.goals.list().then(g => { if (Array.isArray(g)) setGoals(g); }).catch(() => {});
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
  }, []);

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
    await db.cycle.goals.remove(id).catch(() => {});
  };

  return { goals, saved, pipeline, update, add, remove };
}

export type GoalsState = ReturnType<typeof useCycleGoals>;

/** Current value, display text, and 0–1 completion for a goal. */
export function goalStatus(g: CycleGoal, s: GoalsState): { text: string; pct: number | null } {
  const num = (v: number) => (Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1));
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
  const unit = g.unit ? ` ${g.unit}` : "";
  if (g.progress === null || g.progress === undefined) return { text: `goal ${num(g.target ?? 0)}${unit}`, pct: 0 };
  if (g.lower_is_better) {
    const pct = g.target ? Math.min(1, g.target / g.progress) : null;
    return { text: `${num(g.progress)}${unit} → ${num(g.target ?? 0)}`, pct };
  }
  return { text: `${num(g.progress)} / ${num(g.target ?? 0)}${unit}`, pct: g.target ? Math.min(1, g.progress / g.target) : null };
}

export const usesStepper = (g: CycleGoal) =>
  !g.auto && !g.lower_is_better && g.target !== null && g.target <= 10 && Number.isInteger(g.target);

// ─── Weekly tactics ──────────────────────────────────────────────────────────

export function useCycleWeek() {
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
          const fresh = await db.cycle.week.list();
          if (!cancelled && Array.isArray(fresh)) setItems(fresh);
        } else {
          setItems(all);
        }
      } catch { /* leave empty */ } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [monday, inCycle]);

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
