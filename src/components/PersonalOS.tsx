/**
 * PersonalOS.tsx — Dark mode personal dashboard
 * 3-column layout: Goals | Finance + Habits/Calendar | Hello Finn
 */

import { useState, useEffect, useRef } from "react";
import BudgetPanel from "./BudgetPanel";
import WorkoutPanel from "./WorkoutPanel";
import DndPanel from "./DndPanel";
import { db } from "../lib/db";
const uid = () => crypto.randomUUID();
const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── Types ───────────────────────────────────────────────────────────────────

interface Goal {
  id: string;
  title: string;
  type: "weekly" | "daily";
  starred: boolean;
  done: boolean;
  color: string;
  createdAt: string;
}

const GOAL_COLORS = ["#6b7280","#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4"];

interface Habit {
  id: string;
  label: string;
  color: string;
  frequency: number; // times per week target
}

interface PlannedHabit {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  done: boolean;
}

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  time: string;
  description?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const HABIT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(monday: Date): Date[] {
  return DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── Goals Box ───────────────────────────────────────────────────────────────

function GoalsBox({ type, label }: { type: "weekly" | "daily"; label: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState(GOAL_COLORS[0]);

  useEffect(() => {
    db.goals.list().then((all: Goal[]) => setGoals(all.filter((g: Goal) => g.type === type)));
  }, [type]);

  const add = async () => {
    if (!newTitle.trim()) return;
    const goal = { id: uid(), title: newTitle.trim(), type, starred: false, done: false, color: newColor, created_at: new Date().toISOString() };
    const saved = await db.goals.upsert(goal);
    setGoals(g => [...g, saved]);
    setNewTitle("");
  };

  const setColor = async (id: string, color: string) => {
    setGoals(g => g.map(x => x.id === id ? { ...x, color } : x));
    await db.goals.update(id, { color });
  };

  const toggleStar = async (id: string) => {
    const goal = goals.find(g => g.id === id)!;
    setGoals(g => g.map(x => x.id === id ? { ...x, starred: !x.starred } : x));
    await db.goals.update(id, { starred: !goal.starred });
  };

  const toggleDone = async (id: string) => {
    const goal = goals.find(g => g.id === id)!;
    setGoals(g => g.map(x => x.id === id ? { ...x, done: !x.done } : x));
    await db.goals.update(id, { done: !goal.done });
  };

  const remove = async (id: string) => {
    setGoals(g => g.filter(x => x.id !== id));
    await db.goals.delete(id);
  };

  const starred = goals.filter(g => g.starred && !g.done);
  const done = goals.filter(g => g.done);

  return (
    <div className="relative flex flex-col bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5 h-full min-h-64">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
        <button
          onClick={() => setPanelOpen(true)}
          className="text-xs text-gray-500 hover:text-white border border-[#333] rounded-lg px-2 py-1 transition-colors"
          title="View all"
        >
          All →
        </button>
      </div>

      {/* Starred goals */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {starred.length === 0 && done.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-4">
            Star goals to show them here
          </p>
        )}
        {starred.map(g => (
          <div key={g.id} className="flex items-center gap-2 group">
            <button
              onClick={() => toggleDone(g.id)}
              className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center hover:opacity-80 transition-opacity"
              style={{ borderColor: g.color || "#6b7280", backgroundColor: "transparent" }}
            />
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color || "#6b7280" }} />
            <span className="flex-1 text-sm text-gray-200">{g.title}</span>
            <button onClick={() => toggleStar(g.id)} className="text-yellow-400 opacity-0 group-hover:opacity-100 text-xs">★</button>
          </div>
        ))}

        {/* Completed divider + list */}
        {done.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-px bg-[#2e2e2e]" />
              <span className="text-[10px] text-gray-600 uppercase tracking-widest">Completed</span>
              <div className="flex-1 h-px bg-[#2e2e2e]" />
            </div>
            <div className="space-y-2">
              {done.map(g => (
                <div key={g.id} className="flex items-center gap-2 group opacity-50 hover:opacity-70 transition-opacity">
                  <button
                    onClick={() => toggleDone(g.id)}
                    className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center hover:opacity-80"
                    style={{ borderColor: g.color || "#6b7280", backgroundColor: g.color || "#6b7280" }}
                  >
                    <span className="text-white text-[10px]">✓</span>
                  </button>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color || "#6b7280" }} />
                  <span className="flex-1 text-sm text-gray-400 line-through">{g.title}</span>
                  <button onClick={() => remove(g.id)} className="text-gray-600 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Slide panel — all goals */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setPanelOpen(false)}>
          <div
            className="w-80 h-full bg-[#181818] border-l border-[#2e2e2e] flex flex-col p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-semibold text-white">All {label}</span>
              <button onClick={() => setPanelOpen(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>

            {/* Add new */}
            <div className="flex gap-2 mb-2">
              <input
                className="flex-1 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                placeholder="Add goal…"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && add()}
              />
              <button onClick={add} className="bg-white text-black px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">+</button>
            </div>
            <div className="flex gap-1.5 mb-4">
              {GOAL_COLORS.map(c => (
                <button key={c} onClick={() => setNewColor(c)}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c, outline: newColor === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
                />
              ))}
            </div>

            {/* All goals list */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {goals.length === 0 && <p className="text-xs text-gray-600 text-center py-6">No goals yet</p>}
              {goals.filter(g => !g.done).map(g => (
                <div key={g.id} className="flex flex-col gap-2 p-3 rounded-xl border border-[#2a2a2a] hover:border-[#3a3a3a] group">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleDone(g.id)}
                      className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center"
                      style={{ borderColor: g.color || "#6b7280", backgroundColor: "transparent" }} />
                    <span className="flex-1 text-sm text-gray-200">{g.title}</span>
                    <button onClick={() => toggleStar(g.id)}
                      className={`text-sm transition-colors ${g.starred ? "text-yellow-400" : "text-gray-700 group-hover:text-gray-500"}`}>★</button>
                    <button onClick={() => remove(g.id)} className="text-gray-700 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100">✕</button>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {GOAL_COLORS.map(c => (
                      <button key={c} onClick={() => setColor(g.id, c)}
                        className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                        style={{ backgroundColor: c, outline: (g.color || GOAL_COLORS[0]) === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Completed section in panel */}
              {goals.some(g => g.done) && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-[#2e2e2e]" />
                    <span className="text-[10px] text-gray-600 uppercase tracking-widest">Completed</span>
                    <div className="flex-1 h-px bg-[#2e2e2e]" />
                  </div>
                  <div className="space-y-2">
                    {goals.filter(g => g.done).map(g => (
                      <div key={g.id} className="flex flex-col gap-2 p-3 rounded-xl border border-transparent hover:border-[#2a2a2a] group opacity-50 hover:opacity-70 transition-opacity">
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggleDone(g.id)}
                            className="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center"
                            style={{ borderColor: g.color || "#6b7280", backgroundColor: g.color || "#6b7280" }}>
                            <span className="text-white text-[10px]">✓</span>
                          </button>
                          <span className="flex-1 text-sm text-gray-500 line-through">{g.title}</span>
                          <button onClick={() => remove(g.id)} className="text-gray-700 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100">✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Finance Box ─────────────────────────────────────────────────────────────

type SummaryRow = { month: string; category: string; value: number };

function buildCumulativeLine(rows: SummaryRow[], category: string, sortedMonths: string[]): number[] {
  let cum = 0;
  return [0, ...sortedMonths.map(m => {
    const row = rows.find(r => r.month === m && r.category === category);
    cum += row ? Number(row.value) : 0;
    return cum;
  })];
}

function makePath(vals: number[], maxVal: number, W: number, H: number, minVal = 0): string {
  const range = maxVal - minVal || 1;
  return vals.map((v, i) => {
    const x = (vals.length <= 1 ? 0 : (i / (vals.length - 1))) * W;
    const y = H - 4 - ((v - minVal) / range) * (H - 8);
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
}

type FinanceTab = "total" | "savings" | "investments" | "leftover" | "runway";

const FINANCE_TABS: { key: FinanceTab; label: string; color: string }[] = [
  { key: "total",       label: "Total",    color: "#ffffff" },
  { key: "savings",     label: "Savings",  color: "#22c55e" },
  { key: "investments", label: "Investing", color: "#a78bfa" },
  { key: "leftover",    label: "Leftover", color: "#3b82f6" },
  { key: "runway",      label: "20k",      color: "#22c55e" },
];

const RUNWAY_TARGET = 20000;

function RunwayInline({ rows, loading, hoveredIdx, setHoveredIdx }: {
  rows: SummaryRow[]; loading: boolean;
  hoveredIdx: number | null; setHoveredIdx: (i: number | null) => void;
}) {
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const sortedMonths = [...new Set(rows.map(r => r.month))].sort().filter(m => m <= currentMonthKey);
  const monthlySavings  = sortedMonths.map(m => Number(rows.find(r => r.month === m && r.category === "savings")?.value ?? 0));
  const monthlyLeftover = sortedMonths.map(m => Number(rows.find(r => r.month === m && r.category === "leftover")?.value ?? 0));
  let cum = 0;
  const solidPoints: number[] = [0];
  for (let i = 0; i < sortedMonths.length; i++) { cum += monthlySavings[i] + monthlyLeftover[i]; solidPoints.push(cum); }
  const currentTotal = solidPoints[solidPoints.length - 1];
  const avgSavings = monthlySavings.length > 0 ? monthlySavings.reduce((a, b) => a + b, 0) / monthlySavings.length : 0;
  const remaining = RUNWAY_TARGET - currentTotal;
  const monthsLeft = avgSavings > 0 ? Math.ceil(remaining / avgSavings) : null;
  const weeksLeft  = monthsLeft !== null ? Math.ceil(monthsLeft * 4.33) : null;
  const projPoints: { x: number; y: number }[] = [];
  if (avgSavings > 0 && currentTotal < RUNWAY_TARGET) {
    for (let m = 0; m <= (monthsLeft ?? 0); m++) {
      projPoints.push({ x: solidPoints.length - 1 + m, y: Math.min(currentTotal + avgSavings * m, RUNWAY_TARGET) });
    }
  }
  const W = 280, H = 80;
  const totalXPoints = solidPoints.length - 1 + (projPoints.length > 0 ? projPoints.length - 1 : 0);
  const maxX = Math.max(totalXPoints, 1);
  const maxY = Math.max(RUNWAY_TARGET * 1.05, currentTotal * 1.1, 1);
  const xScale = (i: number) => (i / maxX) * W;
  const yScale = (v: number) => H - (v / maxY) * (H - 8);
  const solidPath = solidPoints.map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`).join(" ");
  const projPath  = projPoints.length > 1 ? projPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.x).toFixed(1)} ${yScale(p.y).toFixed(1)}`).join(" ") : null;
  const targetY   = yScale(RUNWAY_TARGET);
  const currentX  = xScale(solidPoints.length - 1);
  const pct = Math.min(100, Math.round((currentTotal / RUNWAY_TARGET) * 100));

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <div className="text-2xl font-bold text-white">${currentTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-gray-500 font-normal">/ $20k ({pct}%)</span></div>
        {monthsLeft !== null && monthsLeft > 0 && (
          <span className="text-xs text-gray-400"><span className="font-semibold text-white">{monthsLeft}mo</span> / <span className="font-semibold text-white">{weeksLeft}wk</span> away</span>
        )}
        {currentTotal >= RUNWAY_TARGET && <span className="text-xs font-semibold text-emerald-400">🎉 Goal reached!</span>}
      </div>
      {loading ? <div className="h-16 flex items-center justify-center text-xs text-gray-600">Loading…</div> : (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
          <line x1={0} y1={targetY} x2={W} y2={targetY} stroke="#374151" strokeWidth={1} strokeDasharray="4 3" />
          <text x={W - 2} y={targetY - 3} textAnchor="end" fontSize={7} fill="#6b7280">$20k</text>
          {solidPoints.length > 1 && <path d={`${solidPath} L ${currentX} ${H} L 0 ${H} Z`} fill="#22c55e" fillOpacity="0.08" />}
          <path d={solidPath} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {projPath && <path d={projPath} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="5 4" strokeOpacity="0.5" strokeLinecap="round" />}
          {solidPoints.slice(1).map((v, i) => {
            const cx = xScale(i + 1), cy = yScale(v), isH = hoveredIdx === i;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={isH ? 4.5 : 3} fill="#22c55e" stroke="#1e1e1e" strokeWidth="1.5" />
                {isH && (
                  <g>
                    <rect x={cx - 38} y={cy - 23} width={76} height={16} rx={4} fill="#1a1a1a" stroke="#333" strokeWidth={1} />
                    <text x={cx} y={cy - 12} textAnchor="middle" fontSize={8} fill="#e5e7eb">{sortedMonths[i]} · ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}</text>
                  </g>
                )}
                <circle cx={cx} cy={cy} r="10" fill="transparent" className="cursor-pointer" onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} />
              </g>
            );
          })}
          {projPoints.length > 0 && <circle cx={xScale(projPoints[projPoints.length - 1].x)} cy={targetY} r="3.5" fill="#fff" stroke="#22c55e" strokeWidth="1.5" />}
          {sortedMonths.map((m, i) => <text key={m} x={xScale(i + 1)} y={H - 1} textAnchor="middle" fontSize={7} fill="#4b5563">{m.slice(5)}</text>)}
        </svg>
      )}
      <div className="mt-2 bg-[#2a2a2a] rounded-full h-1 overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}

function FinanceBox({ onOpenBudget }: { onOpenBudget: () => void }) {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FinanceTab>("total");
  const [hidden, setHidden] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<"prev" | "curr" | null>(null);
  const [hoveredRunwayIdx, setHoveredRunwayIdx] = useState<number | null>(null);

  useEffect(() => {
    db.summary.list().then((data: SummaryRow[]) => {
      setRows(data);
      setLoading(false);
    });
  }, []);

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const sortedMonths = [...new Set(rows.map(r => r.month))].sort().filter(m => m <= currentMonthKey);
  const savingsLine  = buildCumulativeLine(rows, "savings", sortedMonths);
  const investLine   = buildCumulativeLine(rows, "investments", sortedMonths);
  const leftoverLine = buildCumulativeLine(rows, "leftover", sortedMonths);
  const totalLine    = savingsLine.map((v, i) => v + investLine[i] + leftoverLine[i]);

  const lineMap: Record<FinanceTab, number[]> = {
    total: totalLine, savings: savingsLine, investments: investLine, leftover: leftoverLine, runway: [],
  };

  const activeLine = lineMap[tab];
  const activeColor = FINANCE_TABS.find(t => t.key === tab)!.color;
  const activeValue = activeLine.at(-1) ?? 0;

  const W = 280;
  const H = 80;
  const minVal = Math.min(...activeLine, 0);
  const maxVal = Math.max(...activeLine, 1);
  const range = maxVal - minVal || 1;
  const activePath = makePath(activeLine, maxVal, W, H, minVal);
  const yOf = (v: number) => H - 4 - ((v - minVal) / range) * (H - 8);
  const lastY = yOf(activeValue);

  // Last-month-end dot — second-to-last point in the line
  const prevMonthValue = activeLine.length >= 2 ? activeLine[activeLine.length - 2] : null;
  const prevMonthX = activeLine.length >= 2 ? ((activeLine.length - 2) / (activeLine.length - 1)) * W : null;
  const prevMonthY = prevMonthValue !== null ? yOf(prevMonthValue) : null;

  return (
    <div className="w-full bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {FINANCE_TABS.find(t => t.key === tab)!.label}
        </span>
        <div className="flex items-center gap-3">
          <button onClick={() => setHidden(h => !h)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">{hidden ? "Show" : "Hide"}</button>
          <button onClick={onOpenBudget} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">View Budget →</button>
        </div>
      </div>
      <div className={`transition-all duration-200 ${hidden ? "blur-md select-none pointer-events-none" : ""}`}>
      {tab === "runway" ? (
        <RunwayInline rows={rows} loading={loading} hoveredIdx={hoveredRunwayIdx} setHoveredIdx={setHoveredRunwayIdx} />
      ) : (<>
      <div className="text-2xl font-bold mb-2" style={{ color: activeColor }}>
        {loading ? "—" : `${activeValue < 0 ? "-" : ""}$${Math.abs(activeValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
      </div>
      <div className="relative">
      {(
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
          <defs>
            <linearGradient id="finGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {activeLine.length > 1 && (
            <path d={`${activePath} L ${W} ${H} L 0 ${H} Z`} fill="url(#finGrad)" />
          )}
          <path d={activePath} fill="none" stroke={activeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {prevMonthX !== null && prevMonthY !== null && (
            <>
              <line x1={prevMonthX} y1={0} x2={prevMonthX} y2={H} stroke="#374151" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={prevMonthX} cy={prevMonthY} r="3" fill="#374151" stroke={activeColor} strokeWidth="1.5" />
              <circle cx={prevMonthX} cy={prevMonthY} r="8" fill="transparent" className="cursor-pointer"
                onMouseEnter={() => setHoveredNode("prev")} onMouseLeave={() => setHoveredNode(null)} />
            </>
          )}
          {sortedMonths.length > 0 && (
            <>
              <circle cx={W} cy={lastY} r="3" fill={activeColor} />
              <circle cx={W} cy={lastY} r="8" fill="transparent" className="cursor-pointer"
                onMouseEnter={() => setHoveredNode("curr")} onMouseLeave={() => setHoveredNode(null)} />
            </>
          )}
        </svg>
      )}
      {hoveredNode === "prev" && prevMonthX !== null && prevMonthY !== null && prevMonthValue !== null && (
        <div className="absolute pointer-events-none bg-[#1a1a1a] border border-[#333] rounded-lg px-2 py-1 text-xs text-gray-200 whitespace-nowrap z-10"
          style={{ bottom: `${H - prevMonthY + 10}px`, left: `${(prevMonthX / W) * 100}%`, transform: "translateX(-50%)" }}>
          {sortedMonths[sortedMonths.length - 2]} · {prevMonthValue < 0 ? "-" : ""}${Math.abs(prevMonthValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      )}
      {hoveredNode === "curr" && sortedMonths.length > 0 && (
        <div className="absolute pointer-events-none bg-[#1a1a1a] border border-[#333] rounded-lg px-2 py-1 text-xs text-gray-200 whitespace-nowrap z-10"
          style={{ bottom: `${H - lastY + 10}px`, right: 0 }}>
          {sortedMonths[sortedMonths.length - 1]} · {activeValue < 0 ? "-" : ""}${Math.abs(activeValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      )}
      </div>
      </>)}
      </div>
      <div className="flex gap-3 mt-2">
        {FINANCE_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs font-medium transition-colors ${tab === t.key ? "opacity-100" : "opacity-40 hover:opacity-70"}`}
            style={{ color: t.color }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Habits + Calendar ───────────────────────────────────────────────────────

function HabitsCalendar() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [planned, setPlanned] = useState<PlannedHabit[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [newHabit, setNewHabit] = useState("");
  const [newFreq, setNewFreq] = useState(3);
  const [selectedHabit, setSelectedHabit] = useState<string | null>(null);
  const [fullCalOpen, setFullCalOpen] = useState(false);
  const [histExpanded, setHistExpanded] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [gcalEvents, setGcalEvents] = useState<CalendarEvent[]>([]);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalRefreshing, setGcalRefreshing] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [newEventDate, setNewEventDate] = useState(todayStr());
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventTime, setNewEventTime] = useState("09:00");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const fetchGcal = () => {
    setGcalRefreshing(true);
    db.gcal.get().then((res: { connected: boolean; events: { id: string; title: string; start: string; allDay: boolean }[] }) => {
      if (!res?.connected) { setGcalRefreshing(false); return; }
      setGcalConnected(true);
      const mapped: CalendarEvent[] = res.events.map(e => {
        const dt = new Date(e.start);
        const date = e.allDay ? e.start.slice(0, 10) : `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
        const time = e.allDay ? "" : dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        return { id: `gcal_${e.id}`, date, title: e.title, time };
      });
      setGcalEvents(mapped);
      setGcalRefreshing(false);
    }).catch(() => setGcalRefreshing(false));
  };

  useEffect(() => {
    db.habits.list().then((h: Habit[]) => setHabits(h));
    db.planned.list().then((p: PlannedHabit[]) => setPlanned(p.map((x: PlannedHabit & { habit_id?: string }) => ({ ...x, habitId: x.habit_id ?? x.habitId }))));
    db.events.list().then((e: CalendarEvent[]) => setEvents(e));
    fetchGcal();
  }, []);

  const monday = getMondayOf(new Date());
  monday.setDate(monday.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(monday);

  const addHabit = async () => {
    if (!newHabit.trim()) return;
    const color = HABIT_COLORS[habits.length % HABIT_COLORS.length];
    const habit = { id: uid(), label: newHabit.trim(), color, frequency: newFreq };
    const saved = await db.habits.upsert(habit);
    setHabits(h => [...h, saved]);
    setNewHabit("");
  };

  const assignHabit = async (date: string) => {
    if (!selectedHabit) return;
    const plan = { id: uid(), habit_id: selectedHabit, date, done: false };
    const saved = await db.planned.upsert(plan);
    setPlanned(p => [...p, { ...saved, habitId: saved.habit_id }]);
  };

  const toggleDone = async (id: string) => {
    const plan = planned.find(x => x.id === id)!;
    setPlanned(p => p.map(x => x.id === id ? { ...x, done: !x.done } : x));
    await db.planned.update(id, { done: !plan.done });
  };

  const removePlan = async (id: string) => {
    setPlanned(p => p.filter(x => x.id !== id));
    await db.planned.delete(id);
  };

  const removeHabit = async (id: string) => {
    setHabits(h => h.filter(x => x.id !== id));
    setPlanned(p => p.filter(x => x.habitId !== id));
    await db.habits.delete(id);
  };

  const habit = (id: string) => habits.find(h => h.id === id);

  // Full calendar helpers
  const addEvent = async () => {
    if (!newEventTitle.trim()) return;
    const event = { id: uid(), date: newEventDate, title: newEventTitle.trim(), time: newEventTime, description: "" };
    const saved = await db.events.upsert(event);
    setEvents(e => [...e, saved]);
    setNewEventTitle("");
  };

  const saveEvent = async (ev: CalendarEvent) => {
    await db.events.upsert(ev);
    setEvents(es => es.map(e => e.id === ev.id ? ev : e));
    setEditingEvent(null);
  };

  const deleteEvent = async (id: string) => {
    await db.events.delete(id);
    setEvents(es => es.filter(e => e.id !== id));
    setEditingEvent(null);
  };

  const calDays = () => {
    const { year, month } = calMonth;
    const first = new Date(year, month, 1);
    const startOffset = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = Array(startOffset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  };

  const monthLabel = new Date(calMonth.year, calMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      {/* Habit chips */}
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Weekly Habits</span>
          <div className="flex items-center gap-2">
            {selectedHabit && (
              <button onClick={() => setSelectedHabit(null)} className="text-xs text-gray-500 hover:text-white">
                ✕ Deselect
              </button>
            )}
            <button
              onClick={async () => {
                const weekDateStrs = new Set(weekDates.map(d => dateStr(d)));
                const toDelete = planned.filter(x => weekDateStrs.has(x.date));
                setPlanned(p => p.filter(x => !weekDateStrs.has(x.date)));
                await Promise.all(toDelete.map(x => db.planned.delete(x.id)));
              }}
              className="text-xs text-gray-500 hover:text-red-400 border border-[#333] rounded-lg px-2 py-1 transition-colors"
            >
              Clear week
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {habits.map(h => {
            const weekDateStrs = new Set(weekDates.map(d => dateStr(d)));
            const assignedThisWeek = planned.filter(p =>
              p.habitId === h.id && weekDateStrs.has(p.date)
            ).length;
            return (
              <div key={h.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => setSelectedHabit(selectedHabit === h.id ? null : h.id)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5"
                  style={{
                    backgroundColor: selectedHabit === h.id ? h.color : `${h.color}22`,
                    color: selectedHabit === h.id ? "#fff" : h.color,
                    outline: selectedHabit === h.id ? `2px solid ${h.color}` : "none",
                  }}
                >
                  {h.label}
                  <span className="opacity-70 text-[10px]">{h.frequency - assignedThisWeek}/{h.frequency}x</span>
                </button>
                <button onClick={() => removeHabit(h.id)} className="text-gray-700 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100">✕</button>
              </div>
            );
          })}
          {habits.length === 0 && <p className="text-xs text-gray-600">Add habits below to assign them to days</p>}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 bg-[#252525] border border-[#333] rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
            placeholder="New habit…"
            value={newHabit}
            onChange={e => setNewHabit(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addHabit()}
          />
          <select
            className="bg-[#252525] border border-[#333] rounded-lg px-2 py-1.5 text-sm text-gray-300 focus:outline-none"
            value={newFreq}
            onChange={e => setNewFreq(Number(e.target.value))}
            title="Times per week"
          >
            {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}x/wk</option>)}
          </select>
          <button onClick={addHabit} className="bg-white text-black px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200">+</button>
        </div>

        {selectedHabit && (
          <p className="text-xs text-gray-500 mt-2">Click a day below to assign <strong className="text-gray-300">{habit(selectedHabit)?.label}</strong></p>
        )}
      </div>

      {/* Weekly calendar grid */}
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
        {/* Week nav + completion bar */}
        {(() => {
          const weekDateStrs = new Set(weekDates.map(d => dateStr(d)));
          const weekPlans = planned.filter(p => weekDateStrs.has(p.date));
          const weekDone = weekPlans.filter(p => p.done).length;
          const weekTotal = habits.reduce((s, h) => s + h.frequency, 0);
          const pct = weekTotal === 0 ? 0 : Math.round((weekDone / weekTotal) * 100);
          return (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setWeekOffset(w => w - 1)} className="text-gray-500 hover:text-white text-sm px-1">‹</button>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                    {dateStr(weekDates[0])} — {dateStr(weekDates[6])}
                  </span>
                  <button onClick={() => setWeekOffset(w => w + 1)} className="text-gray-500 hover:text-white text-sm px-1">›</button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{weekDone}/{weekTotal} done · {pct}%</span>
                  {!gcalConnected && (
                    <a
                      href="/api/auth/google"
                      className="text-xs text-blue-400 hover:text-blue-300 border border-blue-900 rounded-lg px-2 py-1 transition-colors"
                    >
                      + Google Cal
                    </a>
                  )}
                  {gcalConnected && (
                    <button
                      onClick={() => fetchGcal()}
                      disabled={gcalRefreshing}
                      className="text-xs text-green-500 hover:text-green-400 transition-colors disabled:opacity-50"
                      title="Refresh Google Calendar"
                    >
                      {gcalRefreshing ? "↻ Syncing…" : "● Google Cal ↻"}
                    </button>
                  )}
                  <button
                    onClick={() => setFullCalOpen(true)}
                    className="text-xs text-gray-500 hover:text-white border border-[#333] rounded-lg px-2 py-1"
                  >
                    Full Cal →
                  </button>
                </div>
              </div>
              {weekTotal > 0 && (
                <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#22c55e" : "#3b82f6" }}
                  />
                </div>
              )}
            </div>
          );
        })()}

        <div className="grid grid-cols-7 gap-1.5">
          {weekDates.map((d, i) => {
            const ds = dateStr(d);
            const isToday = ds === todayStr();
            const dayPlans = planned.filter(p => p.date === ds);
            const dayEvents = [...events, ...gcalEvents].filter(e => e.date === ds);

            return (
              <div
                key={i}
                onClick={() => assignHabit(ds)}
                className={`rounded-xl p-2 min-h-48 cursor-pointer transition-colors ${
                  selectedHabit ? "hover:bg-[#2a2a2a]" : ""
                } ${isToday ? "border border-[#3a3a3a] bg-[#242424]" : "border border-[#262626]"}`}
              >
                <div className={`text-xs font-semibold mb-0.5 ${isToday ? "text-white" : "text-gray-600"}`}>{DAYS[i]}</div>
                <div className={`text-lg font-bold mb-1.5 ${isToday ? "text-white" : "text-gray-500"}`}>{d.getDate()}</div>
                <div className="space-y-1">
                  {dayPlans.map(p => {
                    const h = habit(p.habitId);
                    if (!h) return null;
                    return (
                      <div
                        key={p.id}
                        className="group/chip relative flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium cursor-pointer transition-all"
                        style={{
                          backgroundColor: p.done ? `${h.color}60` : `${h.color}22`,
                          color: h.color,
                          textDecoration: p.done ? "line-through" : "none",
                          opacity: p.done ? 0.7 : 1,
                        }}
                        onClick={e => { e.stopPropagation(); toggleDone(p.id); }}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0 border transition-all"
                          style={{
                            backgroundColor: p.done ? h.color : "transparent",
                            borderColor: h.color,
                          }}
                        />
                        <span className="break-words min-w-0">{h.label}</span>
                        <button
                          className="absolute -top-1 -right-1 w-3 h-3 bg-[#1e1e1e] border border-[#333] rounded-full text-gray-500 hover:text-red-400 hidden group-hover/chip:flex items-center justify-center text-xs leading-none"
                          onClick={e => { e.stopPropagation(); removePlan(p.id); }}
                        >×</button>
                      </div>
                    );
                  })}
                  {dayEvents.map(ev => (
                    <div
                      key={ev.id}
                      onClick={e => { e.stopPropagation(); if (!ev.id.startsWith("gcal_")) setEditingEvent(ev); }}
                      className={`text-xs rounded-md px-1.5 py-1 mb-0.5 leading-tight break-words ${ev.id.startsWith("gcal_") ? "bg-green-900/40 text-green-400 border border-green-900/60" : "bg-blue-900/40 text-blue-300 border border-blue-900/60 cursor-pointer hover:bg-blue-900/60"}`}
                    >
                      {ev.time && <span className="opacity-60 mr-1">{ev.time}</span>}{ev.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical completion chart */}
      {(() => {
        const totalFreq = habits.reduce((s, h) => s + h.frequency, 0);
        if (totalFreq === 0 || planned.length === 0) return null;

        // Group planned entries by their Monday date key
        const weekMap = new Map<string, { done: number }>();
        for (const p of planned) {
          const monday = getMondayOf(new Date(p.date + "T00:00:00"));
          const key = dateStr(monday);
          if (!weekMap.has(key)) weekMap.set(key, { done: 0 });
          if (p.done) weekMap.get(key)!.done++;
        }

        const weeks = Array.from(weekMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([, v]) => Math.min(100, Math.round((v.done / totalFreq) * 100)));

        if (weeks.length < 1) return null;

        // Convert to running average (each point = avg of all weeks so far)
        const runningAvg = weeks.map((_, i) =>
          Math.round(weeks.slice(0, i + 1).reduce((s, v) => s + v, 0) / (i + 1))
        );

        const W = 400;
        const H = 60;
        const pad = 8;
        const innerW = W - pad * 2;
        const innerH = H - pad * 2;

        const pts = runningAvg.map((pct, i) => {
          const x = runningAvg.length === 1 ? pad + innerW / 2 : pad + (i / (runningAvg.length - 1)) * innerW;
          const y = pad + innerH - (pct / 100) * innerH;
          return [x, y] as [number, number];
        });

        const linePath = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
        const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${pad + innerH} L ${pts[0][0]} ${pad + innerH} Z`;

        return (
          <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Completion History</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">{weeks.length} week{weeks.length !== 1 ? "s" : ""}</span>
                <button
                  onClick={() => setHistExpanded(x => !x)}
                  className="text-xs text-gray-500 hover:text-white border border-[#333] rounded-lg px-2 py-1 transition-colors"
                >
                  ⤢
                </button>
              </div>
            </div>
            {/* Compact sparkline (always visible) */}
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
              <defs>
                <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1={pad} y1={pad + innerH / 2} x2={W - pad} y2={pad + innerH / 2} stroke="#2a2a2a" strokeWidth="1" strokeDasharray="4 4" />
              <path d={areaPath} fill="url(#histGrad)" />
              <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="2.5" fill="#3b82f6" />
              ))}
            </svg>
            <div className="flex justify-between text-[10px] text-gray-700 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>

            {/* Expanded modal */}
            {histExpanded && (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8" onClick={() => setHistExpanded(false)}>
                <div
                  className="bg-[#181818] border border-[#2e2e2e] rounded-2xl p-8 shadow-2xl w-full max-w-3xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <span className="text-sm font-semibold text-white">Completion History</span>
                      <span className="text-xs text-gray-600 ml-3">{weeks.length} week{weeks.length !== 1 ? "s" : ""} logged</span>
                    </div>
                    <button onClick={() => setHistExpanded(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
                  </div>
                  {(() => {
                    const EW = 600;
                    const EH = 200;
                    const ep = 28;
                    const eiW = EW - ep * 2;
                    const eiH = EH - ep * 2;
                    const epts = runningAvg.map((pct, i) => {
                      const x = runningAvg.length === 1 ? ep + eiW / 2 : ep + (i / (runningAvg.length - 1)) * eiW;
                      const y = ep + eiH - (pct / 100) * eiH;
                      return [x, y] as [number, number];
                    });
                    const eLine = epts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
                    const eArea = `${eLine} L ${epts[epts.length - 1][0]} ${ep + eiH} L ${epts[0][0]} ${ep + eiH} Z`;
                    return (
                      <>
                        <svg viewBox={`0 0 ${EW} ${EH}`} className="w-full" style={{ height: 220 }} preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="histGradE" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          {[0, 25, 50, 75, 100].map(pct => {
                            const ly = ep + eiH - (pct / 100) * eiH;
                            return (
                              <g key={pct}>
                                <line x1={ep} y1={ly} x2={EW - ep} y2={ly} stroke="#252525" strokeWidth="1" strokeDasharray="4 4" />
                                <text x={ep - 6} y={ly + 4} fontSize="9" fill="#555" textAnchor="end">{pct}%</text>
                              </g>
                            );
                          })}
                          <path d={eArea} fill="url(#histGradE)" />
                          <path d={eLine} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          {epts.map(([x, y], i) => (
                            <g key={i}>
                              <circle cx={x} cy={y} r="5" fill="#1e1e1e" stroke="#3b82f6" strokeWidth="2" />
                              <text x={x} y={y - 12} fontSize="10" fill="#9ca3af" textAnchor="middle">{runningAvg[i]}%</text>
                              <text x={x} y={ep + eiH + 16} fontSize="9" fill="#555" textAnchor="middle">W{i + 1}</text>
                            </g>
                          ))}
                        </svg>
                        <div className="flex gap-6 mt-4 pt-4 border-t border-[#2a2a2a]">
                          <div><p className="text-xs text-gray-600">Current avg</p><p className="text-lg font-bold text-white">{runningAvg[runningAvg.length - 1]}%</p></div>
                          <div><p className="text-xs text-gray-600">Best week</p><p className="text-lg font-bold text-white">{Math.max(...weeks)}%</p></div>
                          <div><p className="text-xs text-gray-600">Latest week</p><p className="text-lg font-bold text-white">{weeks[weeks.length - 1]}%</p></div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Full calendar modal */}
      {fullCalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setFullCalOpen(false)}>
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl w-full max-w-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setCalMonth(m => {
                  const d = new Date(m.year, m.month - 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })} className="text-gray-500 hover:text-white">‹</button>
                <span className="text-sm font-semibold text-white">{monthLabel}</span>
                <button onClick={() => setCalMonth(m => {
                  const d = new Date(m.year, m.month + 1);
                  return { year: d.getFullYear(), month: d.getMonth() };
                })} className="text-gray-500 hover:text-white">›</button>
              </div>
              <button onClick={() => setFullCalOpen(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-7 gap-1 mb-5">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <div key={i} className="text-center text-xs text-gray-600 font-medium pb-1">{d}</div>
              ))}
              {calDays().map((day, i) => {
                if (!day) return <div key={i} />;
                const ds = `${calMonth.year}-${String(calMonth.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayEvents = [...events, ...gcalEvents].filter(e => e.date === ds);
                const isToday = ds === todayStr();
                return (
                  <div key={i} className={`rounded-lg p-1.5 min-h-12 ${isToday ? "bg-[#2a2a2a] border border-[#444]" : "hover:bg-[#222]"}`}>
                    <div className={`text-xs font-medium mb-1 ${isToday ? "text-white" : "text-gray-500"}`}>{day}</div>
                    {dayEvents.map(ev => (
                      <div
                        key={ev.id}
                        onClick={() => { if (!ev.id.startsWith("gcal_")) setEditingEvent(ev); }}
                        className={`text-xs rounded px-1.5 py-0.5 mb-0.5 break-words leading-tight border ${ev.id.startsWith("gcal_") ? "bg-green-900/40 text-green-400 border-green-900/60" : "bg-blue-900/40 text-blue-300 border-blue-900/60 cursor-pointer hover:bg-blue-900/60"}`}
                      >{ev.title}</div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Add event */}
            <div className="border-t border-[#2a2a2a] pt-4">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Add Event</p>
              <div className="flex gap-2 flex-wrap">
                <input
                  className="flex-1 min-w-0 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
                  placeholder="Event title…"
                  value={newEventTitle}
                  onChange={e => setNewEventTitle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addEvent()}
                />
                <input type="date" className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} />
                <input type="time" className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} />
                <button onClick={addEvent} className="bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Event edit modal ── */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setEditingEvent(null)}>
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-semibold text-white">Edit Event</span>
              <button onClick={() => setEditingEvent(null)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Title</label>
                <input
                  className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#555]"
                  value={editingEvent.title}
                  onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Date</label>
                  <input
                    type="date"
                    className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#555]"
                    value={editingEvent.date}
                    onChange={e => setEditingEvent({ ...editingEvent, date: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Time</label>
                  <input
                    type="time"
                    className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#555]"
                    value={editingEvent.time}
                    onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Description</label>
                <textarea
                  className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#555] resize-none"
                  rows={3}
                  placeholder="Add a description…"
                  value={editingEvent.description ?? ""}
                  onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-between mt-5">
              <button
                onClick={() => deleteEvent(editingEvent.id)}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >Delete</button>
              <div className="flex gap-2">
                <button onClick={() => setEditingEvent(null)} className="text-sm text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
                <button
                  onClick={() => saveEvent(editingEvent)}
                  className="bg-white text-black px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200"
                >Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




// ─── Weather Box ─────────────────────────────────────────────────────────────

const WMO_LABELS: Record<number, string> = {
  0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

const WMO_EMOJI: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️", 51: "🌦️", 53: "🌦️", 55: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️", 71: "🌨️", 73: "🌨️", 75: "🌨️",
  80: "🌦️", 81: "🌦️", 82: "⛈️", 95: "⛈️", 96: "⛈️", 99: "⛈️",
};

interface WeatherData {
  temp: number;
  feelsLike: number;
  high: number;
  low: number;
  code: number;
  forecast: { date: string; high: number; low: number; code: number }[];
  hourly: { time: string; temp: number; code: number }[];
}

// ─── Defunct / YouTube Widget ─────────────────────────────────────────────────

interface YtVideo { id: string; title: string; thumb: string; }

function DefunctWidget() {
  const [videos, setVideos] = useState<YtVideo[]>([]);
  const [playing, setPlaying] = useState<YtVideo | null>(null);

  useEffect(() => {
    fetch("/api/data/yt-feed?channelId=UCjl8BKz02KHTncEcuEzFeSw")
      .then(r => r.json())
      .then((data: YtVideo[]) => { if (Array.isArray(data) && data.length > 0) setVideos(data); })
      .catch(() => {});
  }, []);

  function pickRandom() {
    if (videos.length === 0) return;
    setPlaying(videos[Math.floor(Math.random() * videos.length)]);
  }

  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Defunct</span>
        {playing && (
          <button onClick={() => setPlaying(null)} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">■ stop</button>
        )}
      </div>
      {playing && (
        <div className="rounded-xl overflow-hidden mb-3" style={{ aspectRatio: "16/9" }}>
          <iframe
            key={playing.id}
            width="100%" height="100%"
            src={`https://www.youtube.com/embed/${playing.id}?autoplay=1`}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      )}
      <button
        onClick={pickRandom}
        disabled={videos.length === 0}
        className="w-full flex items-center justify-center gap-2 bg-[#2a2a2a] hover:bg-[#333] border border-[#333] rounded-xl py-2.5 text-sm font-medium text-gray-200 transition-colors disabled:opacity-40"
      >
        {playing ? "⟳  Next random" : "▶  Play Random Video"}
      </button>
      {playing && (
        <div className="mt-2 text-xs text-gray-600 truncate">{playing.title}</div>
      )}
    </div>
  );
}

function WeatherBox() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showHourly, setShowHourly] = useState(false);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,apparent_temperature,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&hourly=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=8"
    )
      .then(r => r.json())
      .then(d => {
        const todayStr = d.daily.time[0] as string;
        const hourly: { time: string; temp: number; code: number }[] = [];
        (d.hourly.time as string[]).forEach((t, i) => {
          if (t.startsWith(todayStr)) {
            hourly.push({ time: t, temp: Math.round(d.hourly.temperature_2m[i]), code: d.hourly.weather_code[i] });
          }
        });
        setWeather({
          temp: Math.round(d.current.temperature_2m),
          feelsLike: Math.round(d.current.apparent_temperature),
          high: Math.round(d.daily.temperature_2m_max[0]),
          low: Math.round(d.daily.temperature_2m_min[0]),
          code: d.current.weather_code,
          forecast: d.daily.time.map((date: string, i: number) => ({
            date,
            high: Math.round(d.daily.temperature_2m_max[i]),
            low: Math.round(d.daily.temperature_2m_min[i]),
            code: d.daily.weather_code[i],
          })),
          hourly,
        });
      })
      .catch(() => setError(true));
  }, []);

  const dayLabel = (dateStr: string, i: number) => {
    if (i === 0) return "Today";
    if (i === 1) return "Tomorrow";
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
  };

  return (
    <>
      <button
        onClick={() => weather && setExpanded(true)}
        className="w-full text-left bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5 hover:border-[#444] transition-colors"
      >
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">New York</p>
        {error && <p className="text-xs text-gray-600">Weather unavailable</p>}
        {!weather && !error && <p className="text-xs text-gray-600 animate-pulse">Loading…</p>}
        {weather && (
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-white">{weather.temp}°</span>
                <span className="text-sm text-gray-500 mb-1">Feels {weather.feelsLike}°</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{WMO_LABELS[weather.code] ?? "—"}</p>
              <p className="text-xs text-gray-600 mt-1">H:{weather.high}° L:{weather.low}°</p>
            </div>
            <span className="text-4xl">{WMO_EMOJI[weather.code] ?? "🌡️"}</span>
          </div>
        )}
      </button>

      {expanded && weather && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setExpanded(false)}>
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-white">New York</span>
              <button onClick={() => setExpanded(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>
            {/* tab toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowHourly(false)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${!showHourly ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
              >7 Day</button>
              <button
                onClick={() => setShowHourly(true)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${showHourly ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}
              >Today by Hour</button>
            </div>
            {!showHourly && (
              <div className="space-y-2">
                {weather.forecast.map((day, i) => (
                  <div key={day.date} className={`flex items-center justify-between px-3 py-2 rounded-xl ${i === 0 ? "bg-[#252525]" : ""}`}>
                    <span className="text-sm text-gray-300 w-20">{dayLabel(day.date, i)}</span>
                    <span className="text-xl">{WMO_EMOJI[day.code] ?? "🌡️"}</span>
                    <span className="text-xs text-gray-500 flex-1 text-center">{WMO_LABELS[day.code] ?? "—"}</span>
                    <div className="text-right">
                      <span className="text-sm text-white font-medium">{day.high}°</span>
                      <span className="text-sm text-gray-600 ml-2">{day.low}°</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showHourly && (
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {weather.hourly.map(h => {
                  const hour = new Date(h.time).getHours();
                  const ampm = hour === 0 ? "12am" : hour < 12 ? `${hour}am` : hour === 12 ? "12pm" : `${hour - 12}pm`;
                  const isNow = new Date().getHours() === hour;
                  return (
                    <div key={h.time} className={`flex items-center justify-between px-3 py-1.5 rounded-xl ${isNow ? "bg-[#252525]" : ""}`}>
                      <span className={`text-sm w-14 ${isNow ? "text-white font-medium" : "text-gray-400"}`}>{ampm}</span>
                      <span className="text-lg">{WMO_EMOJI[h.code] ?? "🌡️"}</span>
                      <span className="text-xs text-gray-500 flex-1 text-center">{WMO_LABELS[h.code] ?? "—"}</span>
                      <span className={`text-sm font-medium ${isNow ? "text-white" : "text-gray-300"}`}>{h.temp}°</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Notes Box ───────────────────────────────────────────────────────────────

function NotesBox() {
  const [notes, setNotes] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    db.notes.get().then((d: { content: string }) => setNotes(d.content ?? ""));
  }, []);

  const handleChange = (val: string) => {
    setNotes(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => db.notes.save(val), 1000);
    // Auto-resize
    const el = textareaRef.current;
    if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  };

  // Resize on initial load
  useEffect(() => {
    const el = textareaRef.current;
    if (el && notes) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
  }, [notes]);

  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5 flex flex-col">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Notes</p>
      <textarea
        ref={textareaRef}
        className="bg-transparent text-sm text-gray-300 placeholder-gray-700 resize-none focus:outline-none leading-relaxed overflow-hidden"
        style={{ minHeight: "10rem", maxHeight: "30rem" }}
        placeholder="Jot something down…"
        value={notes}
        onChange={e => handleChange(e.target.value)}
      />
    </div>
  );
}

// ─── Whoop Box ───────────────────────────────────────────────────────────────

interface WhoopSleep {
  sleep_performance_percentage: number;
  sleep_efficiency_percentage: number;
  respiratory_rate: number;
  stage_summary: {
    total_in_bed_time_milli: number;
    total_light_sleep_time_milli: number;
    total_slow_wave_sleep_time_milli: number;
    total_rem_sleep_time_milli: number;
    total_awake_time_milli: number;
  };
}

interface WhoopData {
  recovery: { recovery_score: number; hrv_rmssd_milli: number; resting_heart_rate: number; spo2_percentage: number; skin_temp_celsius: number } | null;
  sleep: WhoopSleep | null;
  strain: { strain: number; average_heart_rate: number; max_heart_rate: number; kilojoule: number } | null;
  workouts: { sport_name: string; score: { strain: number; average_heart_rate: number; max_heart_rate: number; kilojoule: number } }[];
  recoveryHistory: { date: string; score: number | null; hrv: number | null }[];
  sleepHistory: { date: string; performance: number | null; hours: string | null }[];
}

function recoveryColor(score: number) {
  if (score >= 67) return "#22c55e";
  if (score >= 34) return "#f59e0b";
  return "#ef4444";
}

function msToHours(ms: number) { return (ms / 3_600_000).toFixed(1); }

function WhoopBox() {
  const [data, setData] = useState<WhoopData | null>(null);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch("/api/whoop/data")
      .then(r => r.json())
      .then(d => {
        if (d.error === "not_connected") setConnected(false);
        else setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sleepHours = data?.sleep?.stage_summary
    ? msToHours(
        data.sleep.stage_summary.total_light_sleep_time_milli +
        data.sleep.stage_summary.total_slow_wave_sleep_time_milli +
        data.sleep.stage_summary.total_rem_sleep_time_milli
      )
    : null;

  return (
    <>
      <button
        onClick={() => data && setExpanded(true)}
        className="w-full text-left bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5 hover:border-[#444] transition-colors"
      >
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">WHOOP</p>

        {loading && <p className="text-xs text-gray-600 animate-pulse">Loading…</p>}

        {!loading && !connected && (
          <div className="text-center py-2">
            <p className="text-xs text-gray-600 mb-3">Not connected</p>
            <a href="/api/whoop/login" onClick={e => e.stopPropagation()}
              className="text-xs bg-white text-black px-3 py-1.5 rounded-lg font-medium hover:bg-gray-200 transition-colors">
              Connect WHOOP
            </a>
          </div>
        )}

        {!loading && connected && data && (
          <div className="space-y-3">
            {data.recovery && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Recovery</p>
                  <p className="text-2xl font-bold" style={{ color: recoveryColor(data.recovery.recovery_score) }}>
                    {data.recovery.recovery_score}%
                  </p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-xs text-gray-400">HRV <span className="text-white">{Math.round(data.recovery.hrv_rmssd_milli)}ms</span></p>
                  <p className="text-xs text-gray-400">RHR <span className="text-white">{data.recovery.resting_heart_rate}bpm</span></p>
                </div>
              </div>
            )}
            <div className="border-t border-[#2a2a2a]" />
            <div className="flex justify-between text-xs">
              {data.sleep && (
                <div>
                  <p className="text-gray-400">Sleep</p>
                  <p className="text-white font-medium">{data.sleep.sleep_performance_percentage}%</p>
                  {sleepHours && <p className="text-gray-300">{sleepHours}h</p>}
                </div>
              )}
              {data.strain && (
                <div className="text-right">
                  <p className="text-gray-400">Strain</p>
                  <p className="text-white font-medium">{data.strain.strain.toFixed(1)}</p>
                  <p className="text-gray-300">{data.strain.average_heart_rate}bpm avg</p>
                </div>
              )}
            </div>
            <p className="text-[10px] text-gray-700 text-right">Tap for details →</p>
          </div>
        )}
      </button>

      {/* Expanded modal */}
      {expanded && data && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={() => setExpanded(false)}>
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl w-full max-w-2xl p-7 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-semibold text-white">WHOOP</span>
              <button onClick={() => setExpanded(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>

            {/* Recovery row */}
            {data.recovery && (
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Recovery", value: `${data.recovery.recovery_score}%`, color: recoveryColor(data.recovery.recovery_score) },
                  { label: "HRV", value: `${Math.round(data.recovery.hrv_rmssd_milli)}ms` },
                  { label: "Resting HR", value: `${data.recovery.resting_heart_rate}bpm` },
                  { label: "SpO2", value: `${data.recovery.spo2_percentage?.toFixed(1)}%` },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#222] rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className="text-lg font-bold" style={{ color: color || "#fff" }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Sleep breakdown */}
            {data.sleep && (
              <div className="mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Sleep</p>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-[#222] rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Performance</p>
                    <p className="text-lg font-bold text-white">{data.sleep.sleep_performance_percentage}%</p>
                  </div>
                  <div className="bg-[#222] rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Efficiency</p>
                    <p className="text-lg font-bold text-white">{data.sleep.sleep_efficiency_percentage?.toFixed(0)}%</p>
                  </div>
                  <div className="bg-[#222] rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">Resp. Rate</p>
                    <p className="text-lg font-bold text-white">{data.sleep.respiratory_rate?.toFixed(1)}</p>
                  </div>
                </div>
                {/* Sleep stage bar */}
                {(() => {
                  const s = data.sleep!.stage_summary;
                  const total = s.total_in_bed_time_milli;
                  const stages = [
                    { label: "Awake", ms: s.total_awake_time_milli, color: "#6b7280" },
                    { label: "Light", ms: s.total_light_sleep_time_milli, color: "#3b82f6" },
                    { label: "Deep", ms: s.total_slow_wave_sleep_time_milli, color: "#8b5cf6" },
                    { label: "REM", ms: s.total_rem_sleep_time_milli, color: "#06b6d4" },
                  ];
                  return (
                    <div>
                      <div className="flex h-4 rounded-full overflow-hidden mb-2">
                        {stages.map(st => (
                          <div key={st.label} style={{ width: `${(st.ms / total) * 100}%`, backgroundColor: st.color }} />
                        ))}
                      </div>
                      <div className="flex gap-4">
                        {stages.map(st => (
                          <div key={st.label} className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: st.color }} />
                            <span className="text-xs text-gray-400">{st.label} <span className="text-white">{msToHours(st.ms)}h</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* HRV trend */}
            {data.recoveryHistory.length > 1 && (
              <div className="mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Recovery — Last {data.recoveryHistory.length} Days</p>
                <div className="flex items-end gap-1.5 h-16">
                  {[...data.recoveryHistory].reverse().map((r, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm"
                        style={{
                          height: `${((r.score ?? 0) / 100) * 52}px`,
                          backgroundColor: recoveryColor(r.score ?? 0),
                          opacity: 0.85,
                        }}
                      />
                      <span className="text-[9px] text-gray-700">{r.score ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sleep history */}
            {data.sleepHistory?.length > 1 && (
              <div className="mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Sleep — Last {data.sleepHistory.length} Nights</p>
                <div className="flex items-end gap-1.5 h-16">
                  {[...data.sleepHistory].reverse().map((s, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-gray-700">{s.hours}h</span>
                      <div
                        className="w-full rounded-sm bg-cyan-500"
                        style={{ height: `${((s.performance ?? 0) / 100) * 40}px`, opacity: 0.8 }}
                      />
                      <span className="text-[9px] text-gray-700">{s.performance ?? "—"}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent workouts */}
            {data.workouts.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Recent Workouts</p>
                <div className="space-y-2">
                  {data.workouts.map((w, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#222] rounded-xl px-4 py-2.5">
                      <span className="text-sm text-gray-200 capitalize">{w.sport_name ?? "Workout"}</span>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>Strain <span className="text-gray-300">{w.score?.strain?.toFixed(1)}</span></span>
                        <span>Avg HR <span className="text-gray-300">{w.score?.average_heart_rate}bpm</span></span>
                        <span>Cal <span className="text-gray-300">{((w.score?.kilojoule ?? 0) / 4.184).toFixed(0)}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Bible Box ───────────────────────────────────────────────────────────────

interface BibleVerse {
  reference: string;
  text: string;
  translation: string;
  reflection: string;
}

function BibleModal({ onClose }: { onClose: () => void }) {
  const [verse, setVerse] = useState<BibleVerse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bible")
      .then(r => r.json())
      .then(d => { setVerse(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-[#181818] border border-[#2e2e2e] rounded-2xl w-full max-w-md p-7 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <span className="text-lg">📖</span>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg">✕</button>
        </div>
        {loading && <p className="text-xs text-gray-600 animate-pulse">Loading verse…</p>}
        {verse && (
          <div className="space-y-5">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{verse.reference}</p>
              <p className="text-white text-base leading-relaxed italic">"{verse.text}"</p>
              <p className="text-xs text-gray-600 mt-2">{verse.translation}</p>
            </div>
            <div className="border-t border-[#2a2a2a] pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Reflection</p>
              <p className="text-gray-300 text-sm leading-relaxed">{verse.reflection}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function PersonalOS() {
  const [showBudget, setShowBudget] = useState(false);
  const [showBible, setShowBible] = useState(false);
  const [showWorkout, setShowWorkout] = useState(false);
  const [showDnd, setShowDnd] = useState(false);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (showDnd) {
    return (
      <div className="min-h-screen bg-[#111] text-white p-8">
        <button onClick={() => setShowDnd(false)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white mb-6 transition-colors">← Back</button>
        <DndPanel />
      </div>
    );
  }

  if (showWorkout) {
    return (
      <div className="min-h-screen bg-[#111] text-white p-8">
        <button onClick={() => setShowWorkout(false)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white mb-6 transition-colors">← Back</button>
        <WorkoutPanel />
      </div>
    );
  }

  if (showBudget) {
    return (
      <div className="min-h-screen bg-[#111] text-white p-8">
        <button
          onClick={() => setShowBudget(false)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-white mb-6 transition-colors"
        >
          ← Back
        </button>
        <BudgetPanel />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-white p-6">
      <div className="grid grid-cols-[1fr_3fr_1fr] gap-5 max-w-7xl mx-auto pt-8">

        {/* ── Left column: Goals + Reddit + Defunct ── */}
        <div className="flex flex-col gap-5">
          <div className="flex-1">
            <GoalsBox type="weekly" label="Weekly Goals" />
          </div>
          <div className="flex-1">
            <GoalsBox type="daily" label="Daily Goals" />
          </div>
          <DefunctWidget />
        </div>

        {/* ── Middle column: Finance + Habits/Calendar ── */}
        <div className="flex flex-col gap-5">
          <FinanceBox onOpenBudget={() => setShowBudget(true)} />
          <HabitsCalendar />
        </div>

        {/* ── Right column: Hello + Weather + Notes ── */}
        <div className="flex flex-col gap-5">
          <div className="relative bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6">
            <button
              onClick={() => setShowBible(true)}
              className="absolute top-4 right-4 text-xl hover:scale-110 transition-transform"
              title="Verse of the day"
            >📖</button>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{greeting}</p>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              Finn
              <button onClick={() => setShowDnd(true)} className="text-xl leading-none bg-white/10 hover:bg-white/20 rounded-lg p-1.5 transition-colors" title="D&D">🐉</button>
              <button className="text-xl leading-none bg-white/10 hover:bg-white/20 rounded-lg p-1.5 transition-colors" title="Notes">✏️</button>
              <button onClick={() => setShowWorkout(true)} className="text-xl leading-none bg-white/10 hover:bg-white/20 rounded-lg p-1.5 transition-colors" title="Workouts">⚔️</button>
            </h1>
            <p className="text-xs text-gray-600 mt-2">
              {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          {showBible && <BibleModal onClose={() => setShowBible(false)} />}
          <WeatherBox />
          <WhoopBox />
          <NotesBox />
        </div>

      </div>
    </div>
  );
}
