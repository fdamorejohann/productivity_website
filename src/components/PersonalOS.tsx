/**
 * PersonalOS.tsx — Dark mode personal dashboard
 * 2-column layout: Finance + Jobs + News (toggleable) | Hello + Weather + Spent + Defunct + Notes
 */

import { useState, useEffect, useRef } from "react";
import type { FormEvent, ReactNode } from "react";
import BudgetPanel from "./BudgetPanel";
import WorkoutPanel from "./WorkoutPanel";
import DndPanel from "./DndPanel";
import RunningPanel from "./RunningPanel";
import TripPanel from "./TripPanel";
import { db } from "../lib/db";
import type { JobPosting, JobStatus, JobUpdate, NewJob } from "../lib/types";
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

// ─── News Widget ─────────────────────────────────────────────────────────────

type NewsTopic = "tech" | "finance" | "nyc";
const NEWS_TABS: { key: NewsTopic; label: string; color: string }[] = [
  { key: "tech",    label: "Tech",    color: "#3b82f6" },
  { key: "finance", label: "Finance", color: "#22c55e" },
  { key: "nyc",     label: "NYC",     color: "#f59e0b" },
];

interface NewsItem { title: string; url: string; source: string; published: string | null; description?: string; }

function NewsWidget({ onHide }: { onHide: () => void }) {
  const [tab, setTab] = useState<NewsTopic>("tech");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const cache = useRef<Partial<Record<NewsTopic, NewsItem[]>>>({});

  useEffect(() => {
    setExpanded(null);
    if (cache.current[tab]) { setItems(cache.current[tab]!); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/data/news?topic=${tab}`)
      .then(r => r.json())
      .then((data: NewsItem[]) => {
        cache.current[tab] = data;
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tab]);

  function timeAgo(pub: string | null) {
    if (!pub) return "";
    const diff = Date.now() - new Date(pub).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const activeColor = NEWS_TABS.find(t => t.key === tab)!.color;

  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">News</span>
        <div className="flex items-center gap-3">
          {NEWS_TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="text-xs font-medium transition-colors"
              style={{ color: t.color, opacity: tab === t.key ? 1 : 0.4 }}>
              {t.label}
            </button>
          ))}
          <button onClick={onHide} title="Hide news"
            className="text-xs text-gray-600 hover:text-gray-300 transition-colors">✕</button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-8 bg-[#252525] rounded-lg animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-4">No articles found</p>
      ) : (
        <div className="space-y-0 divide-y divide-[#2a2a2a]">
          {items.map((item, i) => {
            const isOpen = expanded === i;
            return (
              <div key={i} className="-mx-2 px-2 rounded-lg transition-colors hover:bg-[#252525]">
                {/* Headline row */}
                <div className="py-2.5 cursor-pointer" onClick={() => setExpanded(isOpen ? null : i)}>
                  <div className="text-xs text-gray-200 leading-snug line-clamp-2 mb-1">{item.title}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium" style={{ color: activeColor }}>{item.source}</span>
                    {item.published && <span className="text-[10px] text-gray-600">{timeAgo(item.published)}</span>}
                    <span className="text-[10px] text-gray-700 ml-auto">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>
                {/* Expanded description */}
                {isOpen && (
                  <div className="pb-3">
                    {item.description && (
                      <p className="text-xs text-gray-400 leading-relaxed mb-2">{item.description}{item.description.length >= 400 ? "…" : ""}</p>
                    )}
                    <a href={item.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-medium hover:underline"
                      style={{ color: activeColor }}>
                      Read full article →
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  { key: "pipeline",   label: "Pipeline",   color: "#22d3ee", statuses: ["screen", "interview", "offer"] },
  { key: "archive",    label: "Archive",    color: "#9ca3af", statuses: ["rejected", "withdrawn", "skipped", "closed"] },
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
  if (score === 5) return "#22c55e";
  if (score === 4) return "#84cc16";
  if (score === 3) return "#f59e0b";
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
    return <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs text-gray-600 border border-[#333]" title="Not scored">—</span>;
  }
  const c = fitColor(score);
  return (
    <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
      style={{ color: c, backgroundColor: `${c}22`, border: `1px solid ${c}55` }} title={`Fit ${score}/5`}>
      {score}
    </span>
  );
}

function StatusChip({ status }: { status: JobStatus }) {
  const { label, color } = JOB_STATUS_META[status];
  return (
    <span className="flex-shrink-0 text-[9px] uppercase tracking-wider rounded px-1 border"
      style={{ color, borderColor: `${color}66` }}>{label}</span>
  );
}

const jobInputCls = "w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#555]";

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
        <input type={kind} className={`${jobInputCls} [color-scheme:dark]`} placeholder={placeholder}
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
    <div className="pb-4 pt-1 pl-9 pr-1 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {JOB_QUICK_ACTIONS[job.status].map(a => {
          const c = JOB_STATUS_META[a.to].color;
          return (
            <button key={a.to} onClick={() => onUpdate({ status: a.to })}
              className="text-xs font-medium px-2.5 py-1 rounded-md border transition-colors hover:bg-white/5"
              style={{ color: c, borderColor: `${c}66` }}>
              {a.label}
            </button>
          );
        })}
        <select
          value={job.status}
          onChange={e => onUpdate({ status: e.target.value as JobStatus })}
          title="Set any status"
          className="bg-[#252525] border border-[#333] rounded-md px-2 py-1 text-xs focus:outline-none focus:border-[#555] [color-scheme:dark]"
          style={{ color: JOB_STATUS_META[job.status].color }}>
          {JOB_TABS.map(t => (
            <optgroup key={t.key} label={t.label}>
              {t.statuses.map(s => <option key={s} value={s}>{JOB_STATUS_META[s].label}</option>)}
            </optgroup>
          ))}
        </select>
        <span className="text-[10px] text-gray-600">{daysSince(job.status_changed_at)}d in stage</span>
        {isHttpUrl(job.url) && (
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-xs font-medium text-blue-400 hover:underline">
            Apply →
          </a>
        )}
      </div>

      {/* Fit (scanner rows only — manual rows show "—") */}
      {job.fit_score == null ? (
        <p className="text-xs text-gray-600"><span className="text-[10px] uppercase tracking-widest text-gray-500 mr-2">Fit</span>—</p>
      ) : (
        <>
          {job.fit_summary && <p className="text-xs text-gray-300 leading-relaxed">{job.fit_summary}</p>}
          {(reasons.length > 0 || flags.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Reasons</p>
                <ul className="space-y-0.5">
                  {reasons.map((r, i) => <li key={i} className="text-xs text-gray-400 flex gap-1.5"><span className="text-emerald-500">+</span>{r}</li>)}
                  {reasons.length === 0 && <li className="text-xs text-gray-700">—</li>}
                </ul>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Red flags</p>
                <ul className="space-y-0.5">
                  {flags.map((r, i) => <li key={i} className="text-xs text-gray-400 flex gap-1.5"><span className="text-red-400">!</span>{r}</li>)}
                  {flags.length === 0 && <li className="text-xs text-gray-700">—</li>}
                </ul>
              </div>
            </div>
          )}
          {resume && (
            <p className="text-xs text-gray-500">Resume: <span className="font-mono text-gray-300">{resume}</span></p>
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
    <form onSubmit={submit} className="mb-4 p-3 rounded-xl border border-[#2e2e2e] bg-[#191919] space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input className={jobInputCls} placeholder="Company *" value={form.company} onChange={set("company")} autoFocus />
        <input className={jobInputCls} placeholder="Title *" value={form.title} onChange={set("title")} />
        <input className={jobInputCls} placeholder="URL (optional)" value={form.url} onChange={set("url")} />
        <input className={jobInputCls} placeholder="Location" value={form.location} onChange={set("location")} />
      </div>
      <textarea className={`${jobInputCls} resize-none`} rows={2} placeholder="Why interested?" value={form.why_interested} onChange={set("why_interested")} />
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-400">{error}</span>}
        <button type="button" onClick={onCancel} className="ml-auto text-xs text-gray-500 hover:text-gray-300 px-2 py-1">Cancel</button>
        <button type="submit" disabled={saving}
          className="text-xs font-medium bg-white text-black rounded-md px-3 py-1 hover:bg-gray-200 disabled:opacity-50">
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

  useEffect(() => {
    db.jobs.list()
      .then(data => { if (Array.isArray(data)) setJobs(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const inTab = (j: JobPosting, t: JobTab) => JOB_TABS.find(x => x.key === t)!.statuses.includes(j.status);
  // The open row stays visible even if its status moves it to another tab, until collapsed.
  const visible = jobs.filter(j => inTab(j, tab) || j.id === expanded);
  const activeColor = JOB_TABS.find(t => t.key === tab)!.color;

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
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Jobs</span>
          <button onClick={() => setAdding(a => !a)}
            className="text-[10px] text-gray-500 hover:text-gray-200 border border-[#333] rounded px-1.5 py-0.5 transition-colors">
            {adding ? "× Close" : "+ Add"}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {JOB_TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setExpanded(null); }}
              className="text-xs font-medium transition-colors"
              style={{ color: t.color, opacity: tab === t.key ? 1 : 0.4 }}>
              {t.label} <span className="tabular-nums opacity-70">{jobs.filter(j => inTab(j, t.key)).length}</span>
            </button>
          ))}
        </div>
      </div>

      {adding && <AddJobForm onAdded={onAdded} onCancel={() => setAdding(false)} />}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-8 bg-[#252525] rounded-lg animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-4">No jobs here</p>
      ) : (
        <div className="divide-y divide-[#2a2a2a]">
          {visible.map(job => {
            const isOpen = expanded === job.id;
            const inPipeline = PIPELINE.includes(job.status);
            const showStatus = tab === "pipeline" || tab === "archive" || !inTab(job, tab);
            return (
              <div key={job.id} className={`-mx-2 px-2 rounded-lg transition-colors hover:bg-[#252525] ${ARCHIVE.includes(job.status) && tab !== "archive" ? "opacity-60" : ""}`}>
                <div className="py-2.5 cursor-pointer grid grid-cols-[24px_minmax(0,1fr)_minmax(0,9rem)_6.5rem_auto] items-center gap-3"
                  onClick={() => setExpanded(isOpen ? null : job.id)}>
                  <FitBadge score={job.fit_score} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs text-gray-200 truncate" title={job.title}>{job.title}</span>
                      {showStatus && <StatusChip status={job.status} />}
                      {needsFollowUp(job) && (
                        <span className="flex-shrink-0 text-[9px] uppercase tracking-wider rounded px-1 bg-orange-500/15 text-orange-400 border border-orange-400/40"
                          title={`Follow up on ${fmtShortDate(job.follow_up_on!)}`}>Follow up</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0 text-[10px]">
                      <span className="font-medium truncate flex-shrink-0 max-w-[50%]" style={{ color: activeColor }} title={job.company}>{job.company}</span>
                      {job.next_step && <span className="text-gray-500 truncate" title={job.next_step}>· {job.next_step}</span>}
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-500 flex items-center gap-1.5 min-w-0">
                    <span className="truncate" title={job.location ?? ""}>{job.location ?? "—"}</span>
                    {job.remote && <span className="flex-shrink-0 text-[9px] uppercase tracking-wider text-cyan-400 border border-cyan-400/40 rounded px-1">Remote</span>}
                  </span>
                  <span className="text-[11px] text-gray-400 truncate tabular-nums text-right" title={job.salary ?? ""}>{job.salary ?? "—"}</span>
                  <span className="text-[10px] text-gray-600 text-right tabular-nums whitespace-nowrap">
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

// ─── Spent Today ─────────────────────────────────────────────────────────────

function SpentToday() {
  const [spent, setSpent] = useState<number | null>(null);
  const today = todayStr();
  const month = today.slice(0, 7);

  const fetch = () => {
    db.budget.get(month).then((data: { logs?: { date: string; amount: number; owed?: number }[] } | null) => {
      if (!data?.logs) { setSpent(0); return; }
      const total = data.logs
        .filter((l) => l.date === today)
        .reduce((s, l) => s + (l.owed ?? l.amount), 0);
      setSpent(total);
    }).catch(() => setSpent(0));
  };

  useEffect(() => {
    fetch();
    const onVisible = () => { if (document.visibilityState === "visible") fetch(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  if (spent === null) return null;

  return (
    <div className="bg-[#141414] rounded-2xl border border-[#222] p-5">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Dollars Spent Today</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold tracking-tight ${spent === 0 ? "text-gray-500" : "text-white"}`}>
          ${spent.toFixed(2)}
        </span>
        {spent === 0 && <span className="text-xs text-gray-600">nothing logged yet</span>}
      </div>
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

const NEWS_VISIBLE_KEY = "pos_news_visible";

export default function PersonalOS() {
  const [showBudget, setShowBudget] = useState(false);
  const [showBible, setShowBible] = useState(false);
  const [showWorkout, setShowWorkout] = useState(false);
  const [showDnd, setShowDnd] = useState(false);
  const [showRunning, setShowRunning] = useState(false);
  const [showTrip, setShowTrip] = useState(false);
  const [showNews, setShowNews] = useState(() => {
    try { return localStorage.getItem(NEWS_VISIBLE_KEY) !== "0"; } catch { return true; }
  });
  const toggleNews = () => setShowNews(v => {
    try { localStorage.setItem(NEWS_VISIBLE_KEY, v ? "0" : "1"); } catch { /* ignore */ }
    return !v;
  });

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const fullPage = (onBack: () => void, panel: ReactNode) => (
    <div className="min-h-screen bg-[#111] text-white p-8">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white mb-6 transition-colors">← Back</button>
      {panel}
    </div>
  );

  if (showDnd)     return fullPage(() => setShowDnd(false), <DndPanel />);
  if (showWorkout) return fullPage(() => setShowWorkout(false), <WorkoutPanel />);
  if (showBudget)  return fullPage(() => setShowBudget(false), <BudgetPanel />);
  if (showRunning) return fullPage(() => setShowRunning(false), <RunningPanel />);
  if (showTrip)    return fullPage(() => setShowTrip(false), <TripPanel />);

  const iconBtn = "text-xl leading-none bg-white/10 hover:bg-white/20 rounded-lg p-1.5 transition-colors";

  return (
    <div className="min-h-screen bg-[#111] text-white p-6">
      <div className="grid grid-cols-[3fr_1fr] gap-5 max-w-7xl mx-auto pt-8">

        {/* ── Main column: Finance + Jobs + News ── */}
        <div className="flex flex-col gap-5">
          <FinanceBox onOpenBudget={() => setShowBudget(true)} />
          <JobsPanel />
          {showNews ? (
            <NewsWidget onHide={toggleNews} />
          ) : (
            <button onClick={toggleNews}
              className="self-start text-xs font-semibold text-gray-500 hover:text-gray-300 uppercase tracking-widest border border-[#2e2e2e] rounded-xl px-4 py-2 transition-colors">
              Show News
            </button>
          )}
        </div>

        {/* ── Right column: Hello + Weather + Spent + Defunct + Notes ── */}
        <div className="flex flex-col gap-5">
          <div className="relative bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6">
            <button
              onClick={() => setShowBible(true)}
              className="absolute top-4 right-4 text-xl hover:scale-110 transition-transform"
              title="Verse of the day"
            >📖</button>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{greeting}</p>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <button onClick={() => setShowDnd(true)} className={iconBtn} title="D&D">🐉</button>
              <button className={iconBtn} title="Notes">✏️</button>
              <button onClick={() => setShowWorkout(true)} className={iconBtn} title="Workouts">⚔️</button>
              <button onClick={() => setShowRunning(true)} className={iconBtn} title="10K plan">🏃</button>
              <button onClick={() => setShowTrip(true)} className={iconBtn} title="England & Dublin trip">🍀</button>
            </h1>
            <p className="text-xs text-gray-600 mt-2">
              {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          {showBible && <BibleModal onClose={() => setShowBible(false)} />}
          <WeatherBox />
          <SpentToday />
          <DefunctWidget />
          <NotesBox />
        </div>

      </div>
    </div>
  );
}
