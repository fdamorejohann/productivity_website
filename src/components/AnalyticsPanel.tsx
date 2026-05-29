import { useState } from "react";

// ─── Types (mirrors BudgetPanel — no shared module yet) ───────────────────────

interface BudgetIncomeRow  { id: string; label: string; budget: number; actual: number; }
interface BudgetExpenseRow {
  id: string; label: string; type: "fixed" | "variable";
  bucket: string; budget: number; actual: number | null;
}
interface BudgetExpenseLog {
  id: string; vendor: string; category: string;
  amount: number; card: string; date: string;
  owed?: number; points?: number;
}
interface MonthBudget {
  income: BudgetIncomeRow[];
  expenses: BudgetExpenseRow[];
  logs: BudgetExpenseLog[];
}

// ─── Storage + date helpers ───────────────────────────────────────────────────

function loadBudget(month: string): MonthBudget | null {
  try {
    const raw = localStorage.getItem(`wg_budget_${month}`);
    return raw ? (JSON.parse(raw) as MonthBudget) : null;
  } catch { return null; }
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function prevMonthKey(k: string): string {
  const [y, m] = k.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonthKey(k: string): string {
  const [y, m] = k.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatMonth(k: string): string {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

// ─── SVG chart constants ──────────────────────────────────────────────────────

const VW = 700, VH = 200, ML = 58, MR = 16, MT = 16, MB = 36;
const CW = VW - ML - MR;
const CH = VH - MT - MB;

export default function AnalyticsPanel() {
  const thisMonth = currentMonthKey();
  const [month, setMonth] = useState(thisMonth);

  const data = loadBudget(month);
  const today = todayDateStr();
  const isCurrentMonth = month === thisMonth;
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const lastDay = isCurrentMonth ? parseInt(today.slice(8, 10)) : daysInMonth;

  // ── No data state ──────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Spending Analytics</h1>
            <p className="text-sm text-gray-400 mt-1">{formatMonth(month)}</p>
          </div>
          <MonthNav month={month} thisMonth={thisMonth} onPrev={() => setMonth(prevMonthKey(month))} onNext={() => setMonth(nextMonthKey(month))} onToday={() => setMonth(thisMonth)} />
        </div>
        <div className="flex flex-col items-center justify-center min-h-64 text-center">
          <div className="text-5xl mb-4">💸</div>
          <h2 className="text-lg font-semibold text-gray-700 mb-2">No budget data for {formatMonth(month)}</h2>
          <p className="text-gray-400 text-sm max-w-xs">
            Open the Budget tab, create a budget for this month, and log some expenses to see spending analytics here.
          </p>
        </div>
      </div>
    );
  }

  // ── Derived totals ─────────────────────────────────────────────────────────

  // Income: actual if > 0, else budget
  const totalIncome = data.income.reduce((s, r) => s + (r.actual > 0 ? r.actual : r.budget), 0);

  // All logged expenses (timestamped)
  const totalLogged = data.logs.filter(l => !["rebates", "work"].includes(l.category.toLowerCase())).reduce((s, l) => s + (l.owed ?? l.amount), 0);

  // Fixed expense actuals (not in logs, no timestamp)
  const fixedTotal = data.expenses
    .filter(r => r.type === "fixed")
    .reduce((s, r) => s + (r.actual !== null ? r.actual : r.budget), 0);

  const totalSpent = totalLogged + fixedTotal;
  const balance = totalIncome - totalSpent;

  // ── Balance time series ────────────────────────────────────────────────────
  // Starts at income after fixed costs are committed (we treat fixed as paid on day 1)
  // Then each logged transaction dips the line further

  // Pre-compute per-day logged spending
  const dailySpend: Record<number, number> = {};
  for (const log of data.logs) {
    if (log.date.slice(0, 7) !== month) continue;
    const d = parseInt(log.date.slice(8, 10));
    dailySpend[d] = (dailySpend[d] ?? 0) + (log.owed ?? log.amount);
  }

  interface DayPoint { day: number; balance: number; daySpent: number; }

  // Starting balance = income minus fixed costs (committed at start of month)
  const startBalance = totalIncome - fixedTotal;

  const series: DayPoint[] = [{ day: 0, balance: startBalance, daySpent: 0 }];
  let running = startBalance;
  for (let d = 1; d <= lastDay; d++) {
    const spent = dailySpend[d] ?? 0;
    running -= spent;
    series.push({ day: d, balance: running, daySpent: spent });
  }

  // Y range: max = startBalance, min = 0 or lower if overspent
  const minBalance = Math.min(0, ...series.map(p => p.balance));
  const maxBalance = startBalance;
  const yRange = Math.max(maxBalance - minBalance, 1);

  function xPx(day: number): number {
    return ML + (day / Math.max(lastDay, 1)) * CW;
  }
  function yPx(val: number): number {
    return MT + CH - ((val - minBalance) / yRange) * CH;
  }

  const linePoints = series
    .map(p => `${xPx(p.day).toFixed(1)},${yPx(p.balance).toFixed(1)}`)
    .join(" ");

  const areaPoints = [
    `${xPx(0).toFixed(1)},${yPx(Math.max(0, minBalance)).toFixed(1)}`,
    ...series.map(p => `${xPx(p.day).toFixed(1)},${yPx(p.balance).toFixed(1)}`),
    `${xPx(lastDay).toFixed(1)},${yPx(Math.max(0, minBalance)).toFixed(1)}`,
  ].join(" ");

  // Y-axis gridlines
  const yTicks: number[] = [];
  const step = yRange / 4;
  for (let i = 0; i <= 4; i++) yTicks.push(minBalance + i * step);

  // X-axis labels: every 5 days
  const xLabels = [1];
  for (let d = 5; d <= lastDay; d += 5) xLabels.push(d);
  if (!xLabels.includes(lastDay) && lastDay > 1) xLabels.push(lastDay);

  // ── Top transactions ───────────────────────────────────────────────────────
  const topTxns = [...data.logs].filter(l => l.category.toLowerCase() !== "rebates").sort((a, b) => b.amount - a.amount).slice(0, 10);

  // ── Category totals ────────────────────────────────────────────────────────
  const catMap: Record<string, number> = {};
  for (const log of data.logs) {
    catMap[log.category] = (catMap[log.category] ?? 0) + (log.owed ?? log.amount);
  }
  const catEntries = Object.entries(catMap).sort(([, a], [, b]) => b - a);
  const maxCat = catEntries[0]?.[1] ?? 1;

  // ── Budget comparison (variable expenses only) ─────────────────────────────
  const variableBudgetMap: Record<string, number> = {};
  for (const row of data.expenses.filter(r => r.type === "variable")) {
    variableBudgetMap[row.label] = row.budget;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Spending Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">{formatMonth(month)}</p>
        </div>
        <MonthNav
          month={month} thisMonth={thisMonth}
          onPrev={() => setMonth(prevMonthKey(month))}
          onNext={() => setMonth(nextMonthKey(month))}
          onToday={() => setMonth(thisMonth)}
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Income" value={totalIncome} color="gray" />
        <SummaryCard label="Fixed Costs" value={fixedTotal} color="gray" />
        <SummaryCard label="Variable Spent" value={totalLogged} pct={totalLogged / (totalIncome - fixedTotal || 1) * 100} color="blue" />
        <SummaryCard label="Remaining" value={balance} color={balance >= 0 ? "green" : "red"} />
      </div>

      {/* Balance line chart */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">Balance Over Month</h2>
          <p className="text-xs text-gray-400">
            Starts at income minus fixed costs ({fmtCompact(startBalance)}) · drops as expenses are logged
          </p>
        </div>

        {series.length <= 1 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400">
            No variable expenses logged yet
          </div>
        ) : (
          <>
            <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ maxHeight: 240 }}>
              {/* Gridlines + Y labels */}
              {yTicks.map((val, i) => (
                <g key={i}>
                  <line
                    x1={ML} y1={yPx(val)} x2={ML + CW} y2={yPx(val)}
                    stroke={val === 0 ? "#fca5a5" : "#f3f4f6"}
                    strokeWidth={val === 0 ? "1.5" : "1"}
                    strokeDasharray={val === 0 ? "4 3" : undefined}
                  />
                  <text x={ML - 5} y={yPx(val) + 4} textAnchor="end" fontSize="9" fill="#9ca3af">
                    {fmtCompact(val)}
                  </text>
                </g>
              ))}

              {/* Area fill */}
              <polygon points={areaPoints} fill="#3b82f6" fillOpacity="0.07" />

              {/* Main balance line */}
              <polyline
                points={linePoints}
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Dot + amount label on days with spending */}
              {series.filter(p => p.daySpent > 0).map(p => (
                <g key={p.day}>
                  <circle
                    cx={xPx(p.day).toFixed(1)}
                    cy={yPx(p.balance).toFixed(1)}
                    r="4"
                    fill="#3b82f6"
                    stroke="white"
                    strokeWidth="1.5"
                  />
                  {p.daySpent >= (yRange * 0.04) && (
                    <text
                      x={xPx(p.day).toFixed(1)}
                      y={(yPx(p.balance) - 8).toFixed(1)}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#6b7280"
                    >
                      -{fmtCompact(p.daySpent)}
                    </text>
                  )}
                </g>
              ))}

              {/* X-axis day labels */}
              {xLabels.map(d => (
                <text
                  key={d}
                  x={xPx(d).toFixed(1)}
                  y={VH - MB + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#9ca3af"
                >
                  {d}
                </text>
              ))}

              {/* Axes */}
              <line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#e5e7eb" strokeWidth="1" />
              <line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="#e5e7eb" strokeWidth="1" />
            </svg>

            {/* Legend */}
            <div className="flex items-center gap-5 mt-1 text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5 bg-blue-500 rounded" />
                <span>Running balance</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5 bg-red-300 rounded" style={{ borderTop: "1.5px dashed #fca5a5" }} />
                <span>Zero line</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom two columns */}
      <div className="grid grid-cols-2 gap-6">

        {/* Largest individual expenses */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Largest Expenses</h2>
          {topTxns.length === 0 ? (
            <p className="text-sm text-gray-400">No transactions logged yet.</p>
          ) : (
            <div className="space-y-2.5">
              {topTxns.map((log, i) => (
                <div key={log.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-300 w-4 text-right flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{log.vendor || log.category}</div>
                    <div className="text-xs text-gray-400">
                      {log.category} · {log.date.slice(5).replace("-", "/")}
                      {log.card && log.card !== "NONE" ? ` · ${log.card}` : ""}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums flex-shrink-0">
                    {fmt(log.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category breakdown with budget comparison */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">By Category</h2>
          {catEntries.length === 0 ? (
            <p className="text-sm text-gray-400">No transactions logged yet.</p>
          ) : (
            <div className="space-y-3">
              {catEntries.map(([cat, spent]) => {
                const budget = variableBudgetMap[cat] ?? 0;
                const over = budget > 0 && spent > budget;
                const barPct = budget > 0
                  ? Math.min(100, (spent / budget) * 100)
                  : (spent / maxCat) * 100;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`font-medium ${over ? "text-red-600" : "text-gray-700"}`}>{cat}</span>
                      <span className="text-gray-500 tabular-nums">
                        {fmt(spent)}
                        {budget > 0 && (
                          <span className={`ml-1 ${over ? "text-red-400" : "text-gray-300"}`}>
                            / {fmt(budget)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${over ? "bg-red-400" : "bg-blue-400"}`}
                        style={{ width: `${Math.max(3, barPct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MonthNav({ month, thisMonth, onPrev, onNext, onToday }: {
  month: string; thisMonth: string;
  onPrev: () => void; onNext: () => void; onToday: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"
      >
        ←
      </button>
      {month !== thisMonth && (
        <button onClick={onToday} className="text-xs text-blue-500 hover:underline px-1">
          This month
        </button>
      )}
      <button
        onClick={onNext}
        disabled={month >= thisMonth}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        →
      </button>
    </div>
  );
}

function SummaryCard({ label, value, pct, color }: {
  label: string; value: number; pct?: number;
  color: "gray" | "blue" | "green" | "red";
}) {
  const textColor = {
    gray: "text-gray-900", blue: "text-blue-600",
    green: "text-green-600", red: "text-red-500",
  }[color];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${textColor}`}>{fmt(value)}</p>
      {pct !== undefined && (
        <p className="text-xs text-gray-400 mt-0.5">{Math.round(pct)}% of variable budget</p>
      )}
    </div>
  );
}
