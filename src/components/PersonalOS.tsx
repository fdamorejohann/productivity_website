/**
 * PersonalOS.tsx — Dark mode personal dashboard
 * Light editorial home: giant greeting; right column with the Q4 cycle score and a Learn block (Wikipedia article, artist to listen to, NTS link); the 12-week goals band and this week's tactic board (Cycle.tsx); then one
 * outlined bubble per page (Jobs, Finances, Gym, Calm, Notes, Q4).
 * Each bubble opens a full page; the URL hash (#jobs etc.) tracks the open page.
 */

import { useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import BudgetPanel from "./BudgetPanel";
import WorkoutPanel from "./WorkoutPanel";
import RunningPanel from "./RunningPanel";
import { db } from "../lib/db";
import { useCountUp } from "../lib/useCountUp";
import { CYCLE, goalStatus, useCycleGoals, useCycleWeek } from "../lib/cycle";
import { CalmPage, CyclePage, CycleScore, GoalStrip, GoalsBand, WeekBoard } from "./Cycle";
import JobsFunnel from "./JobsFunnel";
import Learn from "./Learn";
import type { CycleArea, JobCategory, JobPosting, JobStatus, JobUpdate, NewJob } from "../lib/types";
const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── Finance Box ─────────────────────────────────────────────────────────────

type SummaryRow = { month: string; category: string; value: number };

// Months the user has toggled off — excluded from all trend/runway charts.
function excludedMonths(rows: SummaryRow[]): Set<string> {
  return new Set(rows.filter(r => r.category === "excluded" && Number(r.value) === 1).map(r => r.month));
}

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
  { key: "total",       label: "Total",    color: "#111111" },
  { key: "savings",     label: "Savings",  color: "#111111" },
  { key: "investments", label: "Investing", color: "#111111" },
  { key: "leftover",    label: "Leftover", color: "#111111" },
  { key: "runway",      label: "20k",      color: "#111111" },
];

const RUNWAY_TARGET = 20000;

function RunwayInline({ rows, loading, hoveredIdx, setHoveredIdx }: {
  rows: SummaryRow[]; loading: boolean;
  hoveredIdx: number | null; setHoveredIdx: (i: number | null) => void;
}) {
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const excluded = excludedMonths(rows);
  const sortedMonths = [...new Set(rows.map(r => r.month))].sort().filter(m => m <= currentMonthKey && !excluded.has(m));
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
  const shownTotal = useCountUp(currentTotal);

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <div className="text-2xl font-bold text-[#111]">${shownTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm text-gray-500 font-normal">/ $20k ({pct}%)</span></div>
        {monthsLeft !== null && monthsLeft > 0 && (
          <span className="text-xs text-gray-500"><span className="font-semibold text-[#111]">{monthsLeft}mo</span> / <span className="font-semibold text-[#111]">{weeksLeft}wk</span> away</span>
        )}
        {currentTotal >= RUNWAY_TARGET && <span className="text-xs font-semibold text-[#111]">Goal reached</span>}
      </div>
      {loading ? <div className="h-16 flex items-center justify-center text-xs text-gray-500">Loading…</div> : (
        <svg key={sortedMonths.length} viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
          <line x1={0} y1={targetY} x2={W} y2={targetY} stroke="#C9C7BF" strokeWidth={1} strokeDasharray="4 3" />
          <text x={W - 2} y={targetY - 3} textAnchor="end" fontSize={7} fill="#898781">$20k</text>
          {solidPoints.length > 1 && <path className="chart-fade" d={`${solidPath} L ${currentX} ${H} L 0 ${H} Z`} fill="#111111" fillOpacity="0.08" />}
          <path className="chart-draw" pathLength={1} d={solidPath} fill="none" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {projPath && <path className="chart-pop" d={projPath} fill="none" stroke="#111111" strokeWidth="1.5" strokeDasharray="5 4" strokeOpacity="0.5" strokeLinecap="round" />}
          {solidPoints.slice(1).map((v, i) => {
            const cx = xScale(i + 1), cy = yScale(v), isH = hoveredIdx === i;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={isH ? 4.5 : 3} fill="#111111" stroke="#F5F4F0" strokeWidth="1.5" />
                {isH && (
                  <g>
                    <rect x={cx - 38} y={cy - 23} width={76} height={16} rx={4} fill="#F5F4F0" stroke="#C9C7BF" strokeWidth={1} />
                    <text x={cx} y={cy - 12} textAnchor="middle" fontSize={8} fill="#5f5e5a">{sortedMonths[i]} · ${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}</text>
                  </g>
                )}
                <circle cx={cx} cy={cy} r="10" fill="transparent" className="cursor-pointer" onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} />
              </g>
            );
          })}
          {projPoints.length > 0 && <circle cx={xScale(projPoints[projPoints.length - 1].x)} cy={targetY} r="3.5" fill="#F5F4F0" stroke="#111111" strokeWidth="1.5" />}
          {sortedMonths.map((m, i) => <text key={m} x={xScale(i + 1)} y={H - 1} textAnchor="middle" fontSize={7} fill="#898781">{m.slice(5)}</text>)}
        </svg>
      )}
      <div className="mt-2 bg-[#E6E4DE] rounded-full h-1 overflow-hidden">
        <div className="h-full rounded-full bg-[#111] transition-all duration-1000 ease-out" style={{ width: `${Math.min(100, (shownTotal / RUNWAY_TARGET) * 100)}%` }} />
      </div>
    </>
  );
}

function FinanceBox() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FinanceTab>("total");
  const [hidden, setHidden] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<"prev" | "curr" | null>(null);
  const [hoveredRunwayIdx, setHoveredRunwayIdx] = useState<number | null>(null);

  useEffect(() => {
    db.summary.list().then((data: SummaryRow[]) => {
      setRows(data);
      setLoading(false);
    });
  }, []);

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const excluded = excludedMonths(rows);
  const sortedMonths = [...new Set(rows.map(r => r.month))].sort().filter(m => m <= currentMonthKey && !excluded.has(m));
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
  const shownValue = useCountUp(activeValue);

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
    <div className="w-full bg-[#F5F4F0] border border-[#D9D7CF] rounded-[28px] p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          {FINANCE_TABS.find(t => t.key === tab)!.label}
        </span>
        <div className="flex items-center gap-3">
          <button onClick={() => setHidden(h => !h)} className="text-xs text-gray-500 hover:text-[#111] transition-colors">{hidden ? "Show" : "Hide"}</button>
        </div>
      </div>
      <div className={`transition-all duration-200 ${hidden ? "blur-md select-none pointer-events-none" : ""}`}>
      {tab === "runway" ? (
        <RunwayInline rows={rows} loading={loading} hoveredIdx={hoveredRunwayIdx} setHoveredIdx={setHoveredRunwayIdx} />
      ) : (<>
      <div className="text-2xl font-bold mb-2" style={{ color: activeColor }}>
        {loading ? "—" : `${shownValue < 0 ? "-" : ""}$${Math.abs(shownValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
      </div>
      <div className="relative">
      {(
        <svg key={`${tab}-${sortedMonths.length}`} viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
          <defs>
            <linearGradient id="finGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={activeColor} stopOpacity="0.1" />
              <stop offset="100%" stopColor={activeColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {activeLine.length > 1 && (
            <path className="chart-fade" d={`${activePath} L ${W} ${H} L 0 ${H} Z`} fill="url(#finGrad)" />
          )}
          <path className="chart-draw" pathLength={1} d={activePath} fill="none" stroke={activeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {prevMonthX !== null && prevMonthY !== null && (
            <>
              <line x1={prevMonthX} y1={0} x2={prevMonthX} y2={H} stroke="#D9D7CF" strokeWidth={1} />
              <circle cx={prevMonthX} cy={prevMonthY} r="4" fill={activeColor} stroke="#F5F4F0" strokeWidth="2" />
              <circle cx={prevMonthX} cy={prevMonthY} r="8" fill="transparent" className="cursor-pointer"
                onMouseEnter={() => setHoveredNode("prev")} onMouseLeave={() => setHoveredNode(null)} />
            </>
          )}
          {sortedMonths.length > 0 && (
            <>
              <circle className="chart-pop" cx={W} cy={lastY} r="4" fill={activeColor} stroke="#F5F4F0" strokeWidth="2" />
              <circle cx={W} cy={lastY} r="8" fill="transparent" className="cursor-pointer"
                onMouseEnter={() => setHoveredNode("curr")} onMouseLeave={() => setHoveredNode(null)} />
            </>
          )}
        </svg>
      )}
      {hoveredNode === "prev" && prevMonthX !== null && prevMonthY !== null && prevMonthValue !== null && (
        <div className="absolute pointer-events-none bg-[#F5F4F0] border border-[#C9C7BF] rounded-lg px-2 py-1 text-xs text-gray-800 whitespace-nowrap z-10"
          style={{ bottom: `${H - prevMonthY + 10}px`, left: `${(prevMonthX / W) * 100}%`, transform: "translateX(-50%)" }}>
          {sortedMonths[sortedMonths.length - 2]} · {prevMonthValue < 0 ? "-" : ""}${Math.abs(prevMonthValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      )}
      {hoveredNode === "curr" && sortedMonths.length > 0 && (
        <div className="absolute pointer-events-none bg-[#F5F4F0] border border-[#C9C7BF] rounded-lg px-2 py-1 text-xs text-gray-800 whitespace-nowrap z-10"
          style={{ bottom: `${H - lastY + 10}px`, right: 0 }}>
          {sortedMonths[sortedMonths.length - 1]} · {activeValue < 0 ? "-" : ""}${Math.abs(activeValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      )}
      </div>
      </>)}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-4">
        {FINANCE_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${tab === t.key ? "" : "opacity-50 hover:opacity-80"}`}
            style={{ color: t.color, backgroundColor: tab === t.key ? `${t.color}1f` : "transparent" }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Weather codes ───────────────────────────────────────────────────────────

const WMO_LABELS: Record<number, string> = {
  0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};


// ─── Jobs Panel ──────────────────────────────────────────────────────────────
// Rows come from public.job_postings — found + scored by the external scanner, or added
// by hand via "+ Add" (source = 'manual', may have no description / fit score).
// Editable here: status, notes, why_interested, contact, next_step, follow_up_on, applied_at.
// status_changed_at (and applied_at on → applied) are set by a DB trigger.

type JobTab = "new" | "interested" | "applied" | "pipeline" | "archive";
const JOB_TABS: { key: JobTab; label: string; color: string; statuses: JobStatus[] }[] = [
  { key: "new",        label: "New",        color: "#3b82f6", statuses: ["new"] },
  { key: "interested", label: "Interested", color: "#f59e0b", statuses: ["interested"] },
  { key: "applied",    label: "Applied",    color: "#a78bfa", statuses: ["applied"] },
  { key: "pipeline",   label: "Pipeline",   color: "#0891b2", statuses: ["screen", "interview", "offer"] },
  { key: "archive",    label: "Archive",    color: "#6b7280", statuses: ["rejected", "withdrawn", "skipped", "closed"] },
];
// "In process" = applied or further along (used for the "Applied <date> · Nd in stage" line).
const PIPELINE: JobStatus[] = ["applied", "screen", "interview", "offer"];
const ARCHIVE: JobStatus[] = JOB_TABS[4].statuses;

// One-click next moves, per current status. The full dropdown stays available for anything else.
const JOB_QUICK_ACTIONS: Record<JobStatus, { to: JobStatus; label: string }[]> = {
  new:        [{ to: "interested", label: "Interested" }, { to: "applied", label: "I applied" }, { to: "skipped", label: "Skip" }],
  interested: [{ to: "applied", label: "I applied" }, { to: "skipped", label: "Not for me" }],
  applied:    [{ to: "screen", label: "Got a screen" }, { to: "rejected", label: "Rejected" }, { to: "withdrawn", label: "Withdraw" }],
  screen:     [{ to: "interview", label: "Interviewing" }, { to: "rejected", label: "Rejected" }, { to: "withdrawn", label: "Withdraw" }],
  interview:  [{ to: "offer", label: "Got an offer" }, { to: "rejected", label: "Rejected" }, { to: "withdrawn", label: "Withdraw" }],
  offer:      [{ to: "withdrawn", label: "Declined" }],
  rejected:   [{ to: "interested", label: "Reopen" }],
  withdrawn:  [{ to: "interested", label: "Reopen" }],
  skipped:    [{ to: "interested", label: "Interested after all" }],
  closed:     [{ to: "interested", label: "Reopen" }],
};

const JOB_STATUS_META: Record<JobStatus, { label: string; color: string }> = {
  new:        { label: "New",        color: "#9ca3af" },
  interested: { label: "Interested", color: "#f59e0b" },
  applied:    { label: "Applied",    color: "#a78bfa" },
  screen:     { label: "Screen",     color: "#3b82f6" },
  interview:  { label: "Interview",  color: "#3b82f6" },
  offer:      { label: "Offer",      color: "#22c55e" },
  rejected:   { label: "Rejected",   color: "#ef4444" },
  withdrawn:  { label: "Withdrawn",  color: "#6b7280" },
  skipped:    { label: "Skipped",    color: "#6b7280" },
  closed:     { label: "Closed",     color: "#6b7280" },
};

/** Today as YYYY-MM-DD in local time (for comparing against date columns). */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-09-09" → "Sep 9" (parsed as a local date, no timezone shift). */
function fmtShortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function fitColor(score: number | null): string {
  if (score === 5) return "#006300";
  if (score === 4) return "#3f6212";
  if (score === 3) return "#a16207";
  return "#6b7280";
}

function jobAge(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 24) return `${Math.max(h, 0)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const isHttpUrl = (url: string) => /^https?:\/\//i.test(url);
const needsFollowUp = (j: JobPosting) =>
  !!j.follow_up_on && j.follow_up_on <= localToday() && !ARCHIVE.includes(j.status);

function FitBadge({ score }: { score: number | null }) {
  if (score == null) {
    return <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-gray-500 border border-[#C9C7BF]" title="Not scored">—</span>;
  }
  const c = fitColor(score);
  return (
    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
      style={{ color: c, backgroundColor: `${c}22`, border: `1px solid ${c}55` }} title={`Fit ${score}/5`}>
      {score}
    </span>
  );
}

// Category is set from the title by a DB trigger on insert; can be overridden per job.
const JOB_CATEGORY_META: Record<JobCategory, { label: string; color: string }> = {
  lead:     { label: "Lead",     color: "#be185d" },
  engineer: { label: "Engineer", color: "#0f766e" },
  product:  { label: "Product",  color: "#a16207" },
};
const JOB_CATEGORIES = Object.keys(JOB_CATEGORY_META) as JobCategory[];
type JobCategoryFilter = "all" | JobCategory;
const JOBS_CATEGORY_KEY = "pos_jobs_category";

function CategoryChip({ category }: { category: JobCategory | null }) {
  if (!category) return null;
  const { label, color } = JOB_CATEGORY_META[category];
  return (
    <span className="flex-shrink-0 text-[9px] uppercase tracking-wider rounded-full px-1.5 py-px"
      style={{ color, backgroundColor: `${color}1a` }} title="Category">{label}</span>
  );
}

function StatusChip({ status }: { status: JobStatus }) {
  const { label, color } = JOB_STATUS_META[status];
  return (
    <span className="flex-shrink-0 text-[9px] uppercase tracking-wider rounded-full px-1.5 border"
      style={{ color, borderColor: `${color}66` }}>{label}</span>
  );
}

const jobInputCls = "w-full bg-white border border-[#C9C7BF] rounded-xl px-3 py-2 text-xs text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#111]";

/** Text / textarea / date input that saves on blur when the value changed ("" → null).
 *  Callers key it by value so it resets when the server changes the field (e.g. applied_at via trigger). */
function JobField({ label, value, kind = "text", placeholder, onSave }: {
  label: string;
  value: string | null;
  kind?: "text" | "textarea" | "date";
  placeholder?: string;
  onSave: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const commit = () => {
    const next = draft.trim() === "" ? null : draft.trim();
    if (next !== (value ?? null)) onSave(next);
  };
  return (
    <label className="block">
      <span className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">{label}</span>
      {kind === "textarea" ? (
        <textarea className={`${jobInputCls} resize-none`} rows={2} placeholder={placeholder}
          value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} />
      ) : (
        <input type={kind} className={`${jobInputCls} [color-scheme:light]`} placeholder={placeholder}
          value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} />
      )}
    </label>
  );
}

function JobDetails({ job, onUpdate }: {
  job: JobPosting;
  onUpdate: (updates: JobUpdate) => void;
}) {
  const reasons = job.fit_details?.reasons ?? [];
  const flags = job.fit_details?.red_flags ?? [];
  const resume = job.fit_details?.resume ?? null;
  const save = (field: keyof JobUpdate) => (v: string | null) => onUpdate({ [field]: v });

  return (
    <div className="border-t border-[#D9D7CF] mt-1 pt-4 pb-5 pl-10 pr-1 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {JOB_QUICK_ACTIONS[job.status].map(a => {
          const c = JOB_STATUS_META[a.to].color;
          return (
            <button key={a.to} onClick={() => onUpdate({ status: a.to })}
              className="text-xs font-medium px-3 py-1 rounded-full border transition-colors hover:bg-black/5"
              style={{ color: c, borderColor: `${c}66` }}>
              {a.label}
            </button>
          );
        })}
        <select
          value={job.status}
          onChange={e => onUpdate({ status: e.target.value as JobStatus })}
          title="Set any status"
          className="bg-white border border-[#C9C7BF] rounded-full px-3 py-1 text-xs focus:outline-none focus:border-[#111] [color-scheme:light]"
          style={{ color: JOB_STATUS_META[job.status].color }}>
          {JOB_TABS.map(t => (
            <optgroup key={t.key} label={t.label}>
              {t.statuses.map(s => <option key={s} value={s}>{JOB_STATUS_META[s].label}</option>)}
            </optgroup>
          ))}
        </select>
        <span className="text-[10px] text-gray-500">{daysSince(job.status_changed_at)}d in stage</span>
        <select
          value={job.category ?? ""}
          onChange={e => onUpdate({ category: e.target.value as JobCategory })}
          title="Category (auto-set from title — change if it's wrong)"
          className="bg-white border border-[#C9C7BF] rounded-full px-3 py-1 text-xs focus:outline-none focus:border-[#111] [color-scheme:light]"
          style={{ color: job.category ? JOB_CATEGORY_META[job.category].color : "#6b7280" }}>
          {!job.category && <option value="" disabled>Category —</option>}
          {JOB_CATEGORIES.map(c => <option key={c} value={c}>{JOB_CATEGORY_META[c].label}</option>)}
        </select>
        {isHttpUrl(job.url) && (
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-xs font-medium text-blue-600 hover:underline">
            Apply →
          </a>
        )}
      </div>

      {/* Fit (scanner rows only — manual rows show "—") */}
      {job.fit_score == null ? (
        <p className="text-xs text-gray-500"><span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Fit</span>—</p>
      ) : (
        <>
          {job.fit_summary && <p className="text-xs text-gray-600 leading-relaxed">{job.fit_summary}</p>}
          {(reasons.length > 0 || flags.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Reasons</p>
                <ul className="space-y-0.5">
                  {reasons.map((r, i) => <li key={i} className="text-xs text-gray-500 flex gap-1.5"><span className="text-emerald-500">+</span>{r}</li>)}
                  {reasons.length === 0 && <li className="text-xs text-gray-600">—</li>}
                </ul>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Red flags</p>
                <ul className="space-y-0.5">
                  {flags.map((r, i) => <li key={i} className="text-xs text-gray-500 flex gap-1.5"><span className="text-red-600">!</span>{r}</li>)}
                  {flags.length === 0 && <li className="text-xs text-gray-600">—</li>}
                </ul>
              </div>
            </div>
          )}
          {resume && (
            <p className="text-xs text-gray-500">Resume: <span className="font-mono text-gray-600">{resume}</span></p>
          )}
        </>
      )}

      <p className="text-xs text-gray-500 leading-relaxed line-clamp-4">
        <span className="text-[10px] uppercase tracking-widest mr-2">Posting</span>{job.description || "—"}
      </p>

      <JobField key={`why_interested:${job.why_interested ?? ""}`} label="Why interested" kind="textarea" value={job.why_interested} placeholder="What draws you to this one?" onSave={save("why_interested")} />
      <div className="grid grid-cols-2 gap-3">
        <JobField key={`contact:${job.contact ?? ""}`} label="Contact" value={job.contact} placeholder="Recruiter / referral" onSave={save("contact")} />
        <JobField key={`next_step:${job.next_step ?? ""}`} label="Next step" value={job.next_step} placeholder="e.g. Onsite Tue" onSave={save("next_step")} />
        <JobField key={`follow_up_on:${job.follow_up_on ?? ""}`} label="Follow up on" kind="date" value={job.follow_up_on} onSave={save("follow_up_on")} />
        <JobField key={`applied_at:${job.applied_at ?? ""}`} label="Applied on" kind="date" value={job.applied_at} onSave={save("applied_at")} />
      </div>
      <JobField key={`notes:${job.notes ?? ""}`} label="Notes" kind="textarea" value={job.notes} placeholder="Notes…" onSave={save("notes")} />
    </div>
  );
}

function AddJobForm({ onAdded, onCancel }: { onAdded: (job: JobPosting) => void; onCancel: () => void }) {
  const [form, setForm] = useState<NewJob>({ url: "", company: "", title: "", location: "", why_interested: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof NewJob) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.company.trim() || !form.title.trim()) { setError("Company and title are required."); return; }
    setSaving(true); setError(null);
    const res = await db.jobs.create(form);
    setSaving(false);
    if (res.ok) onAdded(res.job); else setError(res.error);
  };

  return (
    <form onSubmit={submit} className="mb-4 p-5 rounded-[28px] border border-[#D9D7CF] bg-[#F5F4F0] space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input className={jobInputCls} placeholder="Company *" value={form.company} onChange={set("company")} autoFocus />
        <input className={jobInputCls} placeholder="Title *" value={form.title} onChange={set("title")} />
        <input className={jobInputCls} placeholder="URL (optional)" value={form.url} onChange={set("url")} />
        <input className={jobInputCls} placeholder="Location" value={form.location} onChange={set("location")} />
      </div>
      <textarea className={`${jobInputCls} resize-none`} rows={2} placeholder="Why interested?" value={form.why_interested} onChange={set("why_interested")} />
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-600">{error}</span>}
        <button type="button" onClick={onCancel} className="ml-auto text-xs text-gray-500 hover:text-[#111] px-2 py-1">Cancel</button>
        <button type="submit" disabled={saving}
          className="text-xs font-semibold bg-[#111] text-[#F5F4F0] rounded-full px-4 py-1.5 hover:bg-[#333] disabled:opacity-50">
          {saving ? "Adding…" : "Add job"}
        </button>
      </div>
    </form>
  );
}

function JobsPanel() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<JobTab>("new");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategoryState] = useState<JobCategoryFilter>(() => {
    try {
      const v = localStorage.getItem(JOBS_CATEGORY_KEY);
      return v && (JOB_CATEGORIES as string[]).includes(v) ? (v as JobCategory) : "all";
    } catch { return "all"; }
  });
  const setCategory = (c: JobCategoryFilter) => {
    setCategoryState(c);
    try { localStorage.setItem(JOBS_CATEGORY_KEY, c); } catch { /* ignore */ }
  };

  useEffect(() => {
    db.jobs.list()
      .then(data => { if (Array.isArray(data)) setJobs(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const inTab = (j: JobPosting, t: JobTab) => JOB_TABS.find(x => x.key === t)!.statuses.includes(j.status);
  // Search spans every tab: all words must match (id, company, title, location, next step, contact, notes, why).
  const q = query.trim().toLowerCase();
  const searching = q !== "";
  const matches = (j: JobPosting) => {
    const hay = [`#${j.id}`, j.company, j.title, j.location, j.next_step, j.contact, j.notes, j.why_interested, j.salary]
      .filter(Boolean).join(" ").toLowerCase();
    return q.split(/\s+/).every(w => hay.includes(w) || (/^#?\d+$/.test(w) && String(j.id) === w.replace("#", "")));
  };
  const inCategory = (j: JobPosting) => category === "all" || j.category === category;
  // Rows in the current view before the category filter (used for the category counts).
  const inView = (j: JobPosting) => searching ? matches(j) : inTab(j, tab);
  // The open row stays visible even if a status/category change moves it out of view, until collapsed.
  const visible = jobs.filter(j => (inView(j) && inCategory(j)) || (!searching && j.id === expanded));

  // Optimistic: apply locally (mirroring the DB trigger), persist, then take the server's row.
  const update = async (id: number, updates: JobUpdate) => {
    const prev = jobs.find(j => j.id === id);
    if (!prev) return;
    const optimistic: JobPosting = { ...prev, ...updates };
    if (updates.status && updates.status !== prev.status) {
      optimistic.status_changed_at = new Date().toISOString();
      if (updates.status === "applied" && !prev.applied_at && updates.applied_at === undefined) optimistic.applied_at = localToday();
    }
    setJobs(js => js.map(j => j.id === id ? optimistic : j));
    try {
      const res = await db.jobs.update(id, updates);
      if (!res || "error" in res) throw new Error();
      setJobs(js => js.map(j => j.id === id ? res : j));
    } catch {
      setJobs(js => js.map(j => j.id === id ? prev : j));
    }
  };

  const onAdded = (job: JobPosting) => {
    setJobs(js => [job, ...js]);
    setAdding(false);
    setTab("interested");
    setExpanded(job.id);
  };

  return (
    <div>
      {!loading && jobs.length > 0 && <JobsFunnel jobs={jobs} />}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {JOB_TABS.map(t => {
          const active = !searching && tab === t.key;
          const n = jobs.filter(j => inTab(j, t.key) && inCategory(j) && (!searching || matches(j))).length;
          return (
            <button key={t.key} onClick={() => { setTab(t.key); setExpanded(null); setQuery(""); }}
              className={`text-left rounded-[22px] border p-4 transition-colors ${active ? "bg-[#111] border-[#111] text-[#ECEBE7]" : "border-[#111] hover:bg-[#111] hover:text-[#ECEBE7]"}`}>
              <div className="text-xs font-medium opacity-70">{t.label}</div>
              <div className="text-3xl font-medium tracking-[-0.04em] tabular-nums mt-1">{n}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[16rem]">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") setQuery(""); }}
            placeholder="Search all jobs — company, title, #id, contact, notes…"
            className="w-full bg-[#F5F4F0] border border-[#D9D7CF] rounded-full pl-10 pr-4 py-2.5 text-sm text-[#111] placeholder-gray-400 focus:outline-none focus:border-[#111] [color-scheme:light]"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">⌕</span>
        </div>
        <div className="flex items-center gap-1 bg-[#F5F4F0] border border-[#D9D7CF] rounded-full p-1 flex-shrink-0">
          {(["all", ...JOB_CATEGORIES] as JobCategoryFilter[]).map(c => {
            const active = category === c;
            const color = c === "all" ? "#111111" : JOB_CATEGORY_META[c].color;
            const n = jobs.filter(j => inView(j) && (c === "all" || j.category === c)).length;
            return (
              <button key={c} onClick={() => { setCategory(c); setExpanded(null); }}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${active ? "bg-[#111] text-[#F5F4F0]" : "text-gray-600 hover:text-[#111]"}`}>
                {c !== "all" && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                {c === "all" ? "All" : JOB_CATEGORY_META[c].label} <span className="tabular-nums opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
        <button onClick={() => setAdding(a => !a)}
          className="text-xs font-semibold bg-[#111] text-[#F5F4F0] rounded-full px-4 py-2.5 hover:bg-[#333] transition-colors flex-shrink-0">
          {adding ? "× Close" : "+ Add job"}
        </button>
      </div>

      {adding && <AddJobForm onAdded={onAdded} onCancel={() => setAdding(false)} />}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-[#F5F4F0] rounded-2xl animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10 bg-[#F5F4F0] border border-[#D9D7CF] rounded-[28px]">{searching ? `No jobs match “${query.trim()}”` : "No jobs here"}{category !== "all" ? ` (${JOB_CATEGORY_META[category].label} only)` : ""}</p>
      ) : (
        <div className="space-y-2">
          {visible.map(job => {
            const isOpen = expanded === job.id;
            const inPipeline = PIPELINE.includes(job.status);
            const showStatus = searching || tab === "pipeline" || tab === "archive" || !inTab(job, tab);
            return (
              <div key={job.id} className={`px-4 rounded-2xl border transition-colors ${isOpen ? "bg-[#F5F4F0] border-[#C9C7BF]" : "bg-[#F5F4F0] border-[#D9D7CF] hover:border-[#111]"} ${ARCHIVE.includes(job.status) && tab !== "archive" ? "opacity-60" : ""}`}>
                <div className="py-3.5 cursor-pointer grid grid-cols-[28px_minmax(0,1fr)_minmax(0,10rem)_6.5rem_auto] items-center gap-3"
                  onClick={() => setExpanded(isOpen ? null : job.id)}>
                  <FitBadge score={job.fit_score} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate" title={job.title}>{job.title}</span>
                      <CategoryChip category={job.category} />
                      {showStatus && <StatusChip status={job.status} />}
                      {needsFollowUp(job) && (
                        <span className="flex-shrink-0 text-[9px] uppercase tracking-wider rounded-full px-1.5 bg-orange-500/15 text-orange-600 border border-orange-600/40"
                          title={`Follow up on ${fmtShortDate(job.follow_up_on!)}`}>Follow up</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0 text-[11px] mt-0.5">
                      <span className="flex-shrink-0 font-mono text-gray-500 tabular-nums" title="Supabase job_postings.id">#{job.id}</span>
                      <span className="font-medium truncate flex-shrink-0 max-w-[50%] text-gray-600" title={job.company}>{job.company}</span>
                      {job.next_step && <span className="text-gray-500 truncate" title={job.next_step}>· {job.next_step}</span>}
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-500 flex items-center gap-1.5 min-w-0">
                    <span className="truncate" title={job.location ?? ""}>{job.location ?? "—"}</span>
                    {job.remote && <span className="flex-shrink-0 text-[9px] uppercase tracking-wider text-cyan-600 border border-cyan-600/40 rounded-full px-1.5">Remote</span>}
                  </span>
                  <span className="text-[11px] text-gray-500 truncate tabular-nums text-right" title={job.salary ?? ""}>{job.salary ?? "—"}</span>
                  <span className="text-[10px] text-gray-500 text-right tabular-nums whitespace-nowrap">
                    {inPipeline
                      ? `${job.applied_at ? `Applied ${fmtShortDate(job.applied_at)} · ` : ""}${daysSince(job.status_changed_at)}d in stage`
                      : jobAge(job.first_seen_at)}
                  </span>
                </div>
                {isOpen && <JobDetails key={job.id} job={job} onUpdate={u => update(job.id, u)} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
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
    <div className="flex flex-col">
      <p className="text-[13px] text-[#5f5e5a] mb-4">
        Saves as you type. Lines starting with <span className="font-mono text-[#111]">[ ]</span>, <span className="font-mono text-[#111]">- [ ]</span> or <span className="font-mono text-[#111]">todo:</span> are no longer shown on Home.
      </p>
      <textarea
        ref={textareaRef}
        className="bg-[#F5F4F0] border border-[#111] rounded-[28px] px-7 py-6 text-base text-[#111] placeholder-gray-400 resize-none focus:outline-none leading-relaxed overflow-hidden"
        style={{ minHeight: "60vh" }}
        placeholder="Jot something down…"
        value={notes}
        onChange={e => handleChange(e.target.value)}
      />
    </div>
  );
}

// ─── Home: weather line ──────────────────────────────────────────────────────

function WeatherLine() {
  const [w, setW] = useState<{ temp: number; code: number; high: number; low: number } | null>(null);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=1"
    )
      .then(r => r.json())
      .then(d => setW({
        temp: Math.round(d.current.temperature_2m),
        code: d.current.weather_code,
        high: Math.round(d.daily.temperature_2m_max[0]),
        low: Math.round(d.daily.temperature_2m_min[0]),
      }))
      .catch(() => {});
  }, []);

  if (!w) return null;
  return <p>{w.temp}° {(WMO_LABELS[w.code] ?? "").toLowerCase()} · H{w.high} L{w.low} · New York</p>;
}

// ─── Home: bubble previews + reminders ───────────────────────────────────────

type Page = "jobs" | "money" | "gym" | "calm" | "notes" | "q4";
const PAGES: Page[] = ["jobs", "money", "gym", "calm", "notes", "q4"];
// Goals on the home band open the page where that area's progress is logged.
const AREA_PAGE: Record<CycleArea, Page> = { fitness: "gym", money: "money", work: "jobs", calm: "calm" };
const PAGE_TITLES: Record<Page, string> = {
  jobs: "Jobs", money: "Finances", gym: "Gym", calm: "Calm", notes: "Notes", q4: CYCLE.name,
};

interface Reminder { text: string; page: Page; }

interface HomeData {
  jobsNew: number;
  jobsPipeline: number;
  jobsFollowUps: number;
  spentToday: number | null;
  sessionsThisWeek: number | null;
  notesFirstLine: string;
  reminders: { jobs: Reminder[]; notes: Reminder[] };
}

function startOfWeekYmd(): string {
  const d = new Date();
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** First sentence of a free-text field, capped so reminders stay one or two lines. */
function shorten(text: string, max = 70): string {
  const first = text.split(/(?<=\.)\s/)[0].replace(/\.$/, "");
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
}

// Open to-dos in the notes scratchpad: "[ ] thing", "- [ ] thing", or "todo: thing".
const NOTE_TODO = /^\s*(?:[-*]\s*)?(?:\[\s\]|todo:?)\s+(.+)$/i;

function useHomeData(reloadKey?: unknown): HomeData {
  const [data, setData] = useState<HomeData>({
    jobsNew: 0, jobsPipeline: 0, jobsFollowUps: 0, spentToday: null, sessionsThisWeek: null, notesFirstLine: "",
    reminders: { jobs: [], notes: [] },
  });
  const setReminders = (key: keyof HomeData["reminders"], list: Reminder[]) =>
    setData(d => ({ ...d, reminders: { ...d.reminders, [key]: list } }));

  useEffect(() => {
    const today = todayStr();
    db.jobs.list().then(jobs => {
      if (!Array.isArray(jobs)) return;
      const followUps = jobs.filter(needsFollowUp);
      const nextSteps = jobs.filter(j => PIPELINE.includes(j.status) && j.next_step && !needsFollowUp(j));
      setData(d => ({
        ...d,
        jobsNew: jobs.filter(j => j.status === "new").length,
        jobsPipeline: jobs.filter(j => PIPELINE.includes(j.status)).length,
        jobsFollowUps: followUps.length,
      }));
      // Several applications at one company often share a next step, so dedupe the text.
      const texts = [
        ...followUps.map(j => `Follow up with ${j.company}${j.next_step ? ` — ${shorten(j.next_step)}` : ""}`),
        ...nextSteps.map(j => `${j.company}: ${shorten(j.next_step!)}`),
      ];
      setReminders("jobs", [...new Set(texts)].map(text => ({ text, page: "jobs" as Page })));
    }).catch(() => {});
    db.budget.get(today.slice(0, 7)).then((b: { logs?: { date: string; amount: number; owed?: number }[] } | null) => {
      const spent = (b?.logs ?? []).filter(l => l.date === today).reduce((sum, l) => sum + (l.owed ?? l.amount), 0);
      setData(d => ({ ...d, spentToday: spent }));
    }).catch(() => setData(d => ({ ...d, spentToday: 0 })));
    db.sessions.list().then((rows: { date: string }[]) => {
      if (!Array.isArray(rows)) return;
      const monday = startOfWeekYmd();
      setData(d => ({ ...d, sessionsThisWeek: rows.filter(r => r.date >= monday).length }));
    }).catch(() => {});
    db.notes.get().then((n: { content?: string }) => {
      const lines = (n?.content ?? "").split("\n").map(l => l.trim()).filter(Boolean);
      setData(d => ({ ...d, notesFirstLine: lines[0] ?? "" }));
      setReminders("notes", lines
        .map(l => l.match(NOTE_TODO)?.[1])
        .filter((t): t is string => !!t)
        .map(t => ({ text: `To do: ${t}`, page: "notes" })));
    }).catch(() => {});
  }, [reloadKey]);

  return data;
}

function pageFromHash(): Page | null {
  const h = window.location.hash.replace(/^#\/?/, "");
  return (PAGES as string[]).includes(h) ? (h as Page) : null;
}

function Bubble({ page, line, sub, onOpen }: { page: Page; line: string; sub: string; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group text-left border border-[#111] rounded-[28px] p-5 flex flex-col justify-between gap-6 min-h-[150px] transition-colors hover:bg-[#111] hover:text-[#ECEBE7]"
    >
      <div className="text-xl font-medium tracking-[-0.03em]">{PAGE_TITLES[page]}</div>
      <div className="text-[13px] leading-snug text-[#5f5e5a] group-hover:text-[#b4b2a9]">
        <div className="truncate">{line}</div>
        <div>{sub}</div>
      </div>
    </button>
  );
}

function GymPage() {
  const [tab, setTab] = useState<"workouts" | "running">("workouts");
  const pill = (key: typeof tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`text-xs font-semibold px-4 py-1.5 rounded-full transition-colors ${tab === key ? "bg-[#111] text-[#F5F4F0]" : "text-gray-500 hover:text-[#111]"}`}
    >{label}</button>
  );
  return (
    <>
      <div className="flex gap-1 bg-[#F5F4F0] border border-[#D9D7CF] rounded-full p-1 w-fit mb-6">
        {pill("workouts", "Workouts")}
        {pill("running", "10K plan")}
      </div>
      {tab === "workouts" ? <WorkoutPanel /> : <RunningPanel />}
    </>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

const display = "font-medium uppercase leading-[0.86] tracking-[-0.055em]";

export default function PersonalOS() {
  const [page, setPage] = useState<Page | null>(pageFromHash);
  // Refetch when the open page changes so Home reflects progress logged elsewhere.
  const home = useHomeData(page);
  const goals = useCycleGoals(page);
  const week = useCycleWeek(page);

  // The hash is the source of truth so refresh and the browser back button work.
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const open = (p: Page) => { window.location.assign(`#${p}`); window.scrollTo(0, 0); };
  const goHome = () => { history.pushState(null, "", window.location.pathname); setPage(null); };

  if (page) {
    return (
      <div className="min-h-screen bg-[#ECEBE7] text-[#111] p-6 sm:p-10">
        <div className="max-w-6xl mx-auto">
          <button onClick={goHome} className="text-sm text-[#5f5e5a] hover:text-[#111] transition-colors">← Home</button>
          <h1 className={`${display} text-6xl sm:text-7xl mt-6 mb-10`}>{PAGE_TITLES[page]}</h1>
          {page === "jobs" && <><GoalStrip area="work" columns={1} /><JobsPanel /></>}
          {page === "money" && <><GoalStrip area="money" columns={1} /><BudgetPanel overviewTop={<FinanceBox />} /></>}
          {page === "gym" && <><GoalStrip area="fitness" /><GymPage /></>}
          {page === "calm" && <CalmPage />}
          {page === "notes" && <div className="max-w-3xl"><NotesBox /></div>}
          {page === "q4" && <CyclePage />}
        </div>
      </div>
    );
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning," : hour < 17 ? "Good afternoon," : "Good evening,";
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const calmGoals = goals.goals.filter(g => g.area === "calm");
  const calmDone = calmGoals.filter(g => (goalStatus(g, goals).pct ?? 0) >= 1).length;
  const weekPct = week.score === null ? null : Math.round(week.score * 100);

  return (
    <div className="min-h-screen bg-[#ECEBE7] text-[#111] p-6 sm:p-10">
      <div className="max-w-6xl mx-auto pt-4 sm:pt-10">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          <h1 className={`${display} text-[clamp(3.5rem,10vw,8.5rem)]`}>
            {greeting.split(" ").map((w, i) => <span key={i} className="block">{w}</span>)}
            <span className="block">Finn</span>
          </h1>
          <div className="lg:max-w-[17rem] lg:pt-3 text-[13px] leading-snug text-[#5f5e5a] space-y-4">
            <div>
              <p>{now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              <WeatherLine />
            </div>
            <button onClick={() => open("q4")} className="block text-left" title={`Open ${CYCLE.name}`}><CycleScore w={week} /></button>
            <Learn onOpenAlbums={() => open("calm")} />
          </div>
        </div>

        <section className="mt-14"><GoalsBand s={goals} onOpenArea={a => open(AREA_PAGE[a])} /></section>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-12">
          <Bubble page="jobs" onOpen={() => open("jobs")}
            line={home.jobsFollowUps > 0 ? `${plural(home.jobsFollowUps, "follow-up")} due` : `${home.jobsNew} new`}
            sub={`${home.jobsPipeline} in pipeline`} />
          <Bubble page="money" onOpen={() => open("money")}
            line={home.spentToday === null ? "…" : `$${home.spentToday.toFixed(2)} today`}
            sub="Budget and savings" />
          <Bubble page="gym" onOpen={() => open("gym")}
            line={home.sessionsThisWeek === null ? "…" : `${plural(home.sessionsThisWeek, "session")} this week`}
            sub="Workouts, 10K plan" />
          <Bubble page="calm" onOpen={() => open("calm")}
            line={calmGoals.length ? `${calmDone} of ${calmGoals.length} goals done` : "…"}
            sub="Books, shows, movies" />
          <Bubble page="notes" onOpen={() => open("notes")} line={home.notesFirstLine || "Empty"} sub="Scratchpad" />
          <Bubble page="q4" onOpen={() => open("q4")}
            line={week.inCycle ? `Week ${week.week} of ${CYCLE.weeks}` : "Review"}
            sub={weekPct === null ? "Goals and tactics" : `${weekPct}% this week`} />
        </div>

        <section className="mt-14"><WeekBoard w={week} /></section>
      </div>
    </div>
  );
}
