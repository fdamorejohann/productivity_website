/**
 * Cycle.tsx — 12 Week Year (Q4 2026): goals, weekly tactics, and the week board.
 *
 * Home shows the cycle score, a goals band, and a Monday–Sunday board of this week's tactics
 * (fixed-day tactics land on their day; the rest wait in the tray to be placed). The Q4 page edits
 * goals and tactics and shows the 12-week scorecard; the Calm page and the Gym / Finances / Jobs
 * headers show each area's goals via GoalStrip.
 *
 * Data: public.cycle_goals, cycle_tactics, cycle_week_items (one row per tactic per week).
 */

import { useState } from "react";
import { db } from "../lib/db";
import type { CycleArea, CycleGoal, CycleTactic, CycleWeekItem } from "../lib/types";
import {
  AREAS, CYCLE, DAY_NAMES, addDays, areaColor, cycleEnd, cycleWeek, goalStatus, listItems, measurements, mondayOf,
  parseYmd, shortDate, useCycleGoals, useCycleWeek, ymd,
} from "../lib/cycle";
import type { GoalsState, WeekState } from "../lib/cycle";

// ─── Goals ───────────────────────────────────────────────────────────────────

const ITEM_PLACEHOLDER: Record<string, string> = {
  books: "Add a book…", visits: "Add a show or museum…", movies: "Add a movie…", steps: "Add a step…",
};

/** List goal: named items to check off (books, shows, movies, game steps). */
function ListPanel({ g, s }: { g: CycleGoal; s: GoalsState }) {
  const [draft, setDraft] = useState("");
  const items = [...listItems(g, s)].sort((a, b) => Number(a.done) - Number(b.done));
  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    s.addItem(g.id, t);
    setDraft("");
  };
  return (
    <div className="pt-2 pb-1 space-y-1">
      {items.map(i => (
        <div key={i.id} className="group flex items-center gap-2 text-[13px]">
          <button onClick={() => s.updateEntry(i.id, { done: !i.done })} aria-label={i.done ? `Uncheck ${i.title}` : `Check off ${i.title}`}
            className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center text-[9px] ${i.done ? "bg-[#111] border-[#111] text-[#ECEBE7]" : "border-[#111] hover:bg-[#111]/10"}`}>
            {i.done ? "✓" : ""}
          </button>
          <span className={`flex-1 min-w-0 truncate ${i.done ? "line-through text-[#5f5e5a]" : ""}`}>{i.title}</span>
          <button onClick={() => s.removeEntry(i.id)} className="opacity-0 group-hover:opacity-100 text-[#5f5e5a] hover:text-red-600 px-1" aria-label={`Remove ${i.title}`}>×</button>
        </div>
      ))}
      <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} onBlur={submit}
        placeholder={ITEM_PLACEHOLDER[g.unit ?? ""] ?? "Add an item…"}
        className="w-full mt-1 bg-transparent border-b border-dashed border-[#C9C7BF] focus:border-[#111] text-[13px] py-1 focus:outline-none placeholder-[#898781]" />
    </div>
  );
}

/** Measure goal: this week's number (time, reps, seconds, miles, hours) plus earlier weeks. */
function MeasurePanel({ g, s }: { g: CycleGoal; s: GoalsState }) {
  const monday = mondayOf();
  const logs = measurements(g, s);
  const current = logs.find(m => m.week_start === monday);
  const [draft, setDraft] = useState(current?.value?.toString() ?? "");
  const commit = () => {
    const v = draft.trim() === "" ? null : Number(draft);
    if (v !== null && !Number.isFinite(v)) return;
    if (v !== (current?.value ?? null)) s.logMeasure(g.id, monday, v);
  };
  const unit = g.unit ? ` ${g.unit}` : "";
  return (
    <div className="pt-2 pb-1">
      <label className="flex items-center gap-2 text-[13px]">
        <span className="text-[#5f5e5a]">This week{g.use_latest ? " (average)" : g.lower_is_better ? " (fastest)" : " (best)"}</span>
        <input type="number" step="any" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-20 bg-white border border-[#111] rounded-full px-3 py-0.5 text-right focus:outline-none" placeholder="—" />
        <span className="text-[#5f5e5a]">{g.unit}</span>
      </label>
      {logs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {logs.map(m => (
            <span key={m.id} className={`text-[11px] rounded-full px-2 py-0.5 border ${m.week_start === monday ? "border-[#111] text-[#111]" : "border-[#C9C7BF] text-[#5f5e5a]"}`}>
              W{cycleWeek(m.week_start!)} · {m.value}{unit}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function GoalLine({ g, s, editable, onOpen }: { g: CycleGoal; s: GoalsState; editable: boolean; onOpen?: () => void }) {
  const { text, pct } = goalStatus(g, s);
  const [open, setOpen] = useState(false);
  const done = pct !== null && pct >= 1;
  const expandable = editable && (g.mode === "list" || g.mode === "measure");
  const title = <span className={`text-[14px] leading-snug text-left ${done ? "line-through decoration-1 text-[#5f5e5a]" : ""}`}>{g.title}</span>;
  return (
    <div className="py-2 border-b border-[#D9D7CF]">
      <div className="flex items-baseline justify-between gap-3">
        {expandable ? (
          <button onClick={() => setOpen(o => !o)} className="flex items-baseline gap-1.5 hover:underline underline-offset-4 decoration-[#C9C7BF]" aria-expanded={open}>
            <span className="text-[10px] text-[#5f5e5a] w-2">{open ? "▾" : "▸"}</span>{title}
          </button>
        ) : onOpen ? (
          <button onClick={onOpen} className="hover:underline underline-offset-4 decoration-[#C9C7BF]">{title}</button>
        ) : title}
        {editable && g.mode === "count" ? (
          <span className="flex items-center gap-1.5 flex-shrink-0 text-[13px]">
            <button className="w-6 h-6 rounded-full border border-[#C9C7BF] hover:border-[#111] leading-none" aria-label={`Less ${g.title}`}
              onClick={() => s.update(g.id, { progress: Math.max(0, (g.progress ?? 0) - 1) })}>−</button>
            <span className="tabular-nums min-w-[3.2rem] text-center text-[#5f5e5a]">{text}</span>
            <button className="w-6 h-6 rounded-full border border-[#111] hover:bg-[#111] hover:text-[#ECEBE7] leading-none" aria-label={`More ${g.title}`}
              onClick={() => s.update(g.id, { progress: (g.progress ?? 0) + 1 })}>+</button>
          </span>
        ) : (
          <button onClick={expandable ? () => setOpen(o => !o) : onOpen} disabled={!expandable && !onOpen}
            className="text-[13px] text-[#5f5e5a] tabular-nums flex-shrink-0 hover:text-[#111] disabled:hover:text-[#5f5e5a]">{text}</button>
        )}
      </div>
      {pct !== null && (
        <div className="h-[3px] bg-[#D9D7CF] rounded-full mt-1.5 overflow-hidden">
          <div className="h-full bg-[#111] rounded-full transition-all duration-700" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
      )}
      {open && g.mode === "list" && <ListPanel g={g} s={s} />}
      {open && g.mode === "measure" && <MeasurePanel g={g} s={s} />}
    </div>
  );
}

function AreaLabel({ area }: { area: CycleArea }) {
  const a = AREAS.find(x => x.key === area)!;
  return (
    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-[#111] mb-1">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />{a.label}
    </div>
  );
}

/** Home: the four areas side by side; tap a goal to open its area page to log progress. */
export function GoalsBand({ s, onOpenArea }: { s: GoalsState; onOpenArea: (area: CycleArea) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
      {AREAS.map(a => (
        <div key={a.key}>
          <AreaLabel area={a.key} />
          {s.goals.filter(g => g.area === a.key).map(g => <GoalLine key={g.id} g={g} s={s} editable={false} onOpen={() => onOpenArea(a.key)} />)}
        </div>
      ))}
    </div>
  );
}

/** Area pages (Gym, Finances, Jobs, Calm): that area's goals with progress you can update. */
export function GoalStrip({ area, columns = 2 }: { area: CycleArea; columns?: 1 | 2 }) {
  const s = useCycleGoals();
  const goals = s.goals.filter(g => g.area === area);
  if (goals.length === 0) return null;
  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between mb-1">
        <AreaLabel area={area} />
        <span className="text-[11px] text-[#5f5e5a]">{CYCLE.name} goals · ends {shortDate(cycleEnd)}</span>
      </div>
      <div className={`grid gap-x-8 ${columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        {goals.map(g => <GoalLine key={g.id} g={g} s={s} editable />)}
      </div>
    </div>
  );
}

// ─── Weekly tactics ──────────────────────────────────────────────────────────

/** Home, right column: cycle position and this week's execution score. */
export function CycleScore({ w }: { w: WeekState }) {
  const pct = w.score === null ? null : Math.round(w.score * 100);
  return (
    <div className="text-[#111]">
      <p className="text-[11px] uppercase tracking-[0.1em] text-[#5f5e5a]">
        {CYCLE.name} · {w.inCycle ? `Week ${w.week} of ${CYCLE.weeks}` : w.week > CYCLE.weeks ? "Week 13 · review" : `Starts ${shortDate(CYCLE.start)}`}
      </p>
      <p className="text-5xl font-medium tracking-[-0.05em] leading-none mt-1 tabular-nums">{pct === null ? "—" : `${pct}%`}</p>
      <p className="text-[12px] text-[#5f5e5a] mt-1">executed this week · target {Math.round(CYCLE.target * 100)}%</p>
      <div className="flex gap-[3px] mt-2.5" aria-label="Weekly scores">
        {w.history.map(h => (
          <div key={h.week} title={`Week ${h.week}${h.score === null ? "" : ` · ${Math.round(h.score * 100)}%`}`}
            className="w-[9px] h-6 rounded-[3px] relative overflow-hidden bg-[#D9D7CF]">
            {h.score !== null && (
              <div className="absolute bottom-0 inset-x-0" style={{ height: `${Math.max(8, h.score * 100)}%`, backgroundColor: h.week === w.week ? "#111" : "#5f5e5a" }} />
            )}
            {h.week === w.week && h.score === null && <div className="absolute inset-0 border border-[#111] rounded-[3px]" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Home: this week Monday–Sunday. Tap a tray tactic, then a day, to place it; tap a placed tactic to check it off. */
export function WeekBoard({ w }: { w: WeekState }) {
  const [selected, setSelected] = useState<string | null>(null);
  const today = ymd(new Date());
  const tacticOf = (i: CycleWeekItem) => w.tactics.find(t => t.id === i.tactic_id);
  const bySort = (a: CycleWeekItem, b: CycleWeekItem) => (tacticOf(a)?.sort ?? 0) - (tacticOf(b)?.sort ?? 0);
  const tray = w.thisWeek.filter(i => i.day === null).sort(bySort);

  if (!w.inCycle) {
    return (
      <p className="text-[13px] text-[#5f5e5a]">
        {w.week > CYCLE.weeks ? "The cycle is over. Review it on the Q4 page and plan the next one." : `The cycle starts ${shortDate(CYCLE.start)}.`}
      </p>
    );
  }

  const place = (day: number) => {
    if (!selected) return;
    w.patch(selected, { day });
    setSelected(null);
  };

  const box = (i: CycleWeekItem, inTray: boolean) => {
    const t = tacticOf(i);
    if (!t) return null;
    const isSel = selected === i.id;
    return (
      <div key={i.id} className="group relative">
        <button
          onClick={e => {
            e.stopPropagation();
            if (inTray) setSelected(isSel ? null : i.id);
            else w.patch(i.id, { done: !i.done });
          }}
          title={inTray ? "Select, then tap a day" : i.done ? "Mark not done" : "Mark done"}
          className={`w-full text-left text-[12px] leading-snug rounded-xl border px-2 py-1.5 transition-colors flex items-start gap-1.5 ${
            inTray
              ? isSel ? "bg-[#111] text-[#ECEBE7] border-[#111]" : "border-dashed border-[#111] hover:bg-[#111]/5"
              : i.done ? "bg-[#111] text-[#ECEBE7] border-[#111]" : "border-[#111] hover:bg-[#111]/5"
          }`}>
          <span className="w-1.5 h-1.5 rounded-full mt-[5px] flex-shrink-0" style={{ backgroundColor: areaColor(t.area) }} />
          <span className="min-w-0">{i.done ? "✓ " : ""}{t.title}</span>
        </button>
        {!inTray && (
          <button onClick={e => { e.stopPropagation(); w.patch(i.id, { day: null, done: false }); }}
            className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-4 h-4 rounded-full bg-[#ECEBE7] border border-[#111] text-[9px] leading-none items-center justify-center"
            aria-label={`Move ${t.title} back to the tray`} title="Back to tray">↩</button>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="text-xl font-medium tracking-[-0.03em]">This week · {shortDate(w.monday)} – {shortDate(addDays(w.monday, 6))}</h2>
        <p className="text-[12px] text-[#5f5e5a]">{selected ? "Now tap a day to place it." : tray.length ? "Tap a tray item, then a day." : "Tap a tactic to check it off."}</p>
      </div>
      {tray.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tray.map(i => <div key={i.id} className="w-[11rem]">{box(i, true)}</div>)}
        </div>
      )}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="grid grid-cols-7 gap-2 min-w-[720px]">
          {DAY_NAMES.map((name, d) => {
            const date = addDays(w.monday, d);
            const isToday = date === today;
            const placed = w.thisWeek.filter(i => i.day === d).sort(bySort);
            return (
              <div key={d} onClick={() => place(d)}
                className={`rounded-[20px] border p-2 min-h-[150px] flex flex-col gap-1.5 transition-colors ${
                  selected ? "cursor-pointer hover:bg-[#111]/5 border-[#111]" : isToday ? "border-[#111]" : "border-[#C9C7BF]"
                } ${date < today ? "opacity-70" : ""}`}>
                <div className="flex items-baseline justify-between px-0.5">
                  <span className={`text-[11px] uppercase tracking-[0.08em] ${isToday ? "text-[#111] font-semibold" : "text-[#5f5e5a]"}`}>{name}</span>
                  <span className={`text-[15px] font-medium tabular-nums ${isToday ? "bg-[#111] text-[#ECEBE7] rounded-full px-1.5" : ""}`}>{parseYmd(date).getDate()}</span>
                </div>
                {placed.map(i => box(i, false))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Q4 page ─────────────────────────────────────────────────────────────────

const cell = "bg-white border border-[#C9C7BF] rounded-full px-3 py-1 text-[13px] focus:outline-none focus:border-[#111]";

function Scorecard({ w }: { w: WeekState }) {
  const H = 140;
  return (
    <div className="border border-[#111] rounded-[28px] p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-xl font-medium tracking-[-0.03em]">Scorecard</h2>
        <span className="text-[12px] text-[#5f5e5a]">{shortDate(CYCLE.start)} – {shortDate(cycleEnd)} · line = {Math.round(CYCLE.target * 100)}% target</span>
      </div>
      <div className="relative" style={{ height: H + 24 }}>
        <div className="absolute inset-x-0 border-t border-dashed border-[#5f5e5a]" style={{ top: H * (1 - CYCLE.target) }} />
        <div className="absolute inset-0 grid grid-cols-12 gap-2 items-end" style={{ height: H }}>
          {w.history.map(h => (
            <div key={h.week} className="h-full flex flex-col justify-end items-center" title={h.score === null ? `Week ${h.week}: no tactics tracked` : `Week ${h.week}: ${Math.round(h.score * 100)}%`}>
              {h.score !== null && <span className="text-[11px] tabular-nums text-[#5f5e5a] mb-1">{Math.round(h.score * 100)}</span>}
              <div className="w-full max-w-[24px] rounded-t-[4px]"
                style={{ height: h.score === null ? 2 : Math.max(2, h.score * H), backgroundColor: h.score === null ? "#D9D7CF" : h.week === w.week ? "#111" : "#5f5e5a" }} />
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 grid grid-cols-12 gap-2" style={{ top: H + 6 }}>
          {w.history.map(h => (
            <span key={h.week} className={`text-center text-[11px] ${h.week === w.week ? "text-[#111] font-semibold" : "text-[#5f5e5a]"}`}>W{h.week}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalsEditor({ s }: { s: GoalsState }) {
  return (
    <div className="border border-[#111] rounded-[28px] p-6">
      <h2 className="text-xl font-medium tracking-[-0.03em] mb-4">Goals</h2>
      <div className="grid grid-cols-1 gap-y-6">
        {AREAS.map(a => (
          <div key={a.key}>
            <AreaLabel area={a.key} />
            {s.goals.filter(g => g.area === a.key).map(g => (
              <div key={g.id} className="flex items-center gap-2 py-1.5 border-b border-[#D9D7CF]">
                <input key={`t-${g.title}`} defaultValue={g.title} className={`${cell} flex-1 min-w-0`}
                  onBlur={e => { const v = e.target.value.trim(); if (v && v !== g.title) s.update(g.id, { title: v }); }} />
                <input key={`p-${g.progress}`} type="number" step="any" defaultValue={g.progress ?? ""} disabled={g.mode !== "count"}
                  title={g.mode === "count" ? "Progress" : "Tracked from its checklist, weekly numbers, or data"} placeholder={g.mode === "count" ? "now" : "auto"} className={`${cell} w-20 disabled:opacity-50`}
                  onBlur={e => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== g.progress) s.update(g.id, { progress: v }); }} />
                <input key={`g-${g.target}`} type="number" step="any" defaultValue={g.target ?? ""} title="Target" placeholder="goal" className={`${cell} w-20`}
                  onBlur={e => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== g.target) s.update(g.id, { target: v }); }} />
                <input key={`u-${g.unit}`} defaultValue={g.unit ?? ""} title="Unit" placeholder="unit" className={`${cell} w-20`}
                  onBlur={e => { const v = e.target.value.trim() || null; if (v !== g.unit) s.update(g.id, { unit: v }); }} />
                {!g.auto && (
                  <select value={g.mode} title="How it's tracked" className={cell}
                    onChange={e => s.update(g.id, { mode: e.target.value as CycleGoal["mode"] })}>
                    <option value="count">Counter</option>
                    <option value="list">Checklist</option>
                    <option value="measure">Weekly number</option>
                  </select>
                )}
                <button onClick={() => { if (confirm(`Delete goal "${g.title}"?`)) s.remove(g.id); }}
                  className="text-[#5f5e5a] hover:text-red-600 px-1" aria-label={`Delete ${g.title}`}>×</button>
              </div>
            ))}
            <button className="text-[12px] text-[#111] hover:underline underline-offset-2 mt-2"
              onClick={() => s.add({ area: a.key, title: "New goal", target: null, progress: null, unit: null, lower_is_better: false, auto: null, mode: "count", use_latest: false, sort: 99 })}>
              + Add goal
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TacticsEditor({ w }: { w: WeekState }) {
  const update = async (id: string, updates: Partial<CycleTactic>) => {
    w.setTactics(ts => ts.map(t => t.id === id ? { ...t, ...updates } : t));
    await db.cycle.tactics.update(id, updates).catch(() => {});
  };
  const add = async () => {
    const created = await db.cycle.tactics.add({ area: "fitness", title: "New tactic", default_day: null, active: true, sort: w.tactics.length + 1 });
    if (created?.id) w.setTactics(ts => [...ts, created]);
  };
  const remove = async (t: CycleTactic) => {
    if (!confirm(`Delete "${t.title}"? Its past check-offs go too. Turn it off instead to keep history.`)) return;
    w.setTactics(ts => ts.filter(x => x.id !== t.id));
    await db.cycle.tactics.remove(t.id).catch(() => {});
  };
  return (
    <div className="border border-[#111] rounded-[28px] p-6">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="text-xl font-medium tracking-[-0.03em]">Weekly tactics</h2>
        <button onClick={add} className="text-xs font-semibold bg-[#111] text-[#F5F4F0] rounded-full px-4 py-1.5 hover:bg-[#333]">+ Add tactic</button>
      </div>
      <p className="text-[12px] text-[#5f5e5a] mb-4">Fixed-day tactics land on their day each Monday; “Tray” ones wait to be placed. New tactics join this week on your next visit to Home.</p>
      {[...w.tactics].sort((a, b) => a.sort - b.sort).map(t => (
        <div key={t.id} className={`flex flex-wrap items-center gap-2 py-1.5 border-b border-[#D9D7CF] ${t.active ? "" : "opacity-50"}`}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: areaColor(t.area) }} />
          <input key={`t-${t.title}`} defaultValue={t.title} className={`${cell} flex-1 min-w-[12rem]`}
            onBlur={e => { const v = e.target.value.trim(); if (v && v !== t.title) update(t.id, { title: v }); }} />
          <select value={t.area} onChange={e => update(t.id, { area: e.target.value as CycleArea })} className={cell}>
            {AREAS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
          <select value={t.default_day ?? ""} onChange={e => update(t.id, { default_day: e.target.value === "" ? null : Number(e.target.value) })} className={cell}>
            <option value="">Tray</option>
            {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-[#5f5e5a]">
            <input type="checkbox" checked={t.active} onChange={e => update(t.id, { active: e.target.checked })} className="accent-[#111]" />
            On
          </label>
          <button onClick={() => remove(t)} className="text-[#5f5e5a] hover:text-red-600 px-1" aria-label={`Delete ${t.title}`}>×</button>
        </div>
      ))}
    </div>
  );
}

export function CyclePage() {
  const s = useCycleGoals();
  const w = useCycleWeek();
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] text-[#5f5e5a] -mt-6">
        {shortDate(CYCLE.start)} – {shortDate(cycleEnd)} · {w.inCycle ? `week ${w.week} of ${CYCLE.weeks}` : "outside the cycle"} · week 13 ({shortDate(addDays(cycleEnd, 1))}) is for review
      </p>
      <Scorecard w={w} />
      <GoalsEditor s={s} />
      <TacticsEditor w={w} />
    </div>
  );
}

/** Calm page: books, shows, movies, screen time, and the speedboat game. */
export function CalmPage() {
  return (
    <div className="max-w-3xl">
      <GoalStrip area="calm" columns={1} />
      <p className="text-[13px] text-[#5f5e5a]">Open a goal to add books, shows, movies, or game steps and check them off. Log screen time as your weekly average.</p>
    </div>
  );
}
