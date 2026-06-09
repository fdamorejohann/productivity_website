/**
 * RunningPanel.tsx — 12-week 10K training plan tracker
 * Graph + checklist. Checking off a run auto-logs it to the workout page.
 */

import { useState, useEffect } from "react";
import { db } from "../lib/db";

const uid = () => crypto.randomUUID();
const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── Plan data ────────────────────────────────────────────────────────────────

interface RunDef {
  week: number;
  runNumber: 1 | 2;
  label: string;
  miles: number;
  isLong: boolean;
  isCutback: boolean;
  isRace: boolean;
}

const PLAN: RunDef[] = [
  // Week 1
  { week: 1,  runNumber: 1, label: "3 miles easy",         miles: 3,   isLong: false, isCutback: false, isRace: false },
  { week: 1,  runNumber: 2, label: "4 miles",              miles: 4,   isLong: true,  isCutback: false, isRace: false },
  // Week 2
  { week: 2,  runNumber: 1, label: "3 miles easy",         miles: 3,   isLong: false, isCutback: false, isRace: false },
  { week: 2,  runNumber: 2, label: "4.5 miles",            miles: 4.5, isLong: true,  isCutback: false, isRace: false },
  // Week 3
  { week: 3,  runNumber: 1, label: "3.5 miles easy",       miles: 3.5, isLong: false, isCutback: false, isRace: false },
  { week: 3,  runNumber: 2, label: "5 miles",              miles: 5,   isLong: true,  isCutback: false, isRace: false },
  // Week 4 — cutback
  { week: 4,  runNumber: 1, label: "3 miles easy",         miles: 3,   isLong: false, isCutback: true,  isRace: false },
  { week: 4,  runNumber: 2, label: "3.5 miles",            miles: 3.5, isLong: true,  isCutback: true,  isRace: false },
  // Week 5
  { week: 5,  runNumber: 1, label: "3.5 miles easy",       miles: 3.5, isLong: false, isCutback: false, isRace: false },
  { week: 5,  runNumber: 2, label: "5.5 miles",            miles: 5.5, isLong: true,  isCutback: false, isRace: false },
  // Week 6
  { week: 6,  runNumber: 1, label: "4 miles easy",         miles: 4,   isLong: false, isCutback: false, isRace: false },
  { week: 6,  runNumber: 2, label: "6 miles",              miles: 6,   isLong: true,  isCutback: false, isRace: false },
  // Week 7
  { week: 7,  runNumber: 1, label: "4 miles easy",         miles: 4,   isLong: false, isCutback: false, isRace: false },
  { week: 7,  runNumber: 2, label: "6.5 miles",            miles: 6.5, isLong: true,  isCutback: false, isRace: false },
  // Week 8 — cutback
  { week: 8,  runNumber: 1, label: "3 miles easy",         miles: 3,   isLong: false, isCutback: true,  isRace: false },
  { week: 8,  runNumber: 2, label: "4 miles",              miles: 4,   isLong: true,  isCutback: true,  isRace: false },
  // Week 9
  { week: 9,  runNumber: 1, label: "4 miles easy",         miles: 4,   isLong: false, isCutback: false, isRace: false },
  { week: 9,  runNumber: 2, label: "6.5 miles",            miles: 6.5, isLong: true,  isCutback: false, isRace: false },
  // Week 10
  { week: 10, runNumber: 1, label: "4 miles moderate",     miles: 4,   isLong: false, isCutback: false, isRace: false },
  { week: 10, runNumber: 2, label: "7 miles",              miles: 7,   isLong: true,  isCutback: false, isRace: false },
  // Week 11
  { week: 11, runNumber: 1, label: "3 miles easy",         miles: 3,   isLong: false, isCutback: false, isRace: false },
  { week: 11, runNumber: 2, label: "5 miles",              miles: 5,   isLong: true,  isCutback: false, isRace: false },
  // Week 12 — race week
  { week: 12, runNumber: 1, label: "2–3 miles easy",       miles: 2.5, isLong: false, isCutback: false, isRace: false },
  { week: 12, runNumber: 2, label: "10K race / time trial",miles: 6.2, isLong: true,  isCutback: false, isRace: true  },
];

// ─── Completion record ────────────────────────────────────────────────────────

interface Completion {
  id: string;
  week: number;
  run_number: number;
  completed_date: string;
  session_id: string | null;
}

// ─── SVG Graph ────────────────────────────────────────────────────────────────

function RunGraph({ completions }: { completions: Completion[] }) {
  const W = 660, H = 220;
  const PAD = { top: 20, right: 20, bottom: 36, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);
  const maxMiles = 7.5;
  const xStep = innerW / 13; // extra padding on ends

  const toX = (week: number) => PAD.left + week * xStep;
  const toY = (miles: number) => PAD.top + innerH - (miles / maxMiles) * innerH;

  const easyRuns = PLAN.filter(r => r.runNumber === 1);
  const longRuns = PLAN.filter(r => r.runNumber === 2);

  const isDone = (week: number, runNumber: number) =>
    completions.some(c => c.week === week && c.run_number === runNumber);

  // Build polyline points
  const easyPts = easyRuns.map(r => `${toX(r.week)},${toY(r.miles)}`).join(" ");
  const longPts = longRuns.map(r => `${toX(r.week)},${toY(r.miles)}`).join(" ");

  const yLabels = [0, 2, 4, 6, 8].filter(v => v <= maxMiles);

  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">12-Week Progression</span>
        <div className="flex items-center gap-4 text-[10px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-orange-400 inline-block rounded" />Easy run</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded" />Long run</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2a2a2a] border border-[#3a3a3a] inline-block" />Cutback week</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Cutback week bands */}
        {[4, 8].map(w => (
          <rect
            key={w}
            x={toX(w) - xStep / 2}
            y={PAD.top}
            width={xStep}
            height={innerH}
            fill="#2a2a2a"
            rx="2"
          />
        ))}

        {/* Race week band */}
        <rect
          x={toX(12) - xStep / 2}
          y={PAD.top}
          width={xStep}
          height={innerH}
          fill="#1a2a1a"
          rx="2"
        />

        {/* Y grid lines + labels */}
        {yLabels.map(v => {
          const y = toY(v);
          return (
            <g key={v}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#252525" strokeWidth="1" strokeDasharray="4 3" />
              <text x={PAD.left - 6} y={y + 4} fontSize="9" fill="#555" textAnchor="end">{v}mi</text>
            </g>
          );
        })}

        {/* Easy run line */}
        <polyline points={easyPts} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />

        {/* Long run line */}
        <polyline points={longPts} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* Easy run dots */}
        {easyRuns.map(r => {
          const done = isDone(r.week, 1);
          return (
            <circle
              key={`e${r.week}`}
              cx={toX(r.week)} cy={toY(r.miles)} r={done ? 6 : 4}
              fill={done ? "#f97316" : "#1e1e1e"}
              stroke="#f97316" strokeWidth="2"
            />
          );
        })}

        {/* Long run dots */}
        {longRuns.map(r => {
          const done = isDone(r.week, 2);
          return (
            <circle
              key={`l${r.week}`}
              cx={toX(r.week)} cy={toY(r.miles)} r={done ? 6 : 4}
              fill={done ? "#3b82f6" : "#1e1e1e"}
              stroke={r.isRace ? "#22c55e" : "#3b82f6"} strokeWidth="2"
            />
          );
        })}

        {/* X axis week labels */}
        {weeks.map(w => (
          <text key={w} x={toX(w)} y={H - 8} fontSize="9" fill="#555" textAnchor="middle">
            {w === 12 ? "🏁" : `W${w}`}
          </text>
        ))}
      </svg>

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 bg-[#252525] rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${(completions.length / 24) * 100}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 tabular-nums">{completions.length}/24 runs</span>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function RunningPanel() {
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null); // "week-run" being processed
  const [dateInputs, setDateInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    db.runningCompletions.list().then((data: Completion[]) => {
      setCompletions(data);
      setLoading(false);
    });
  }, []);

  const key = (week: number, run: number) => `${week}-${run}`;

  const isDone = (week: number, runNumber: number) =>
    completions.find(c => c.week === week && c.run_number === runNumber);

  const toggleRun = async (run: RunDef) => {
    const k = key(run.week, run.runNumber);
    const existing = isDone(run.week, run.runNumber);

    if (existing) {
      // Uncheck: remove completion + delete linked workout session
      setChecking(k);
      setCompletions(cs => cs.filter(c => !(c.week === run.week && c.run_number === run.runNumber)));
      if (existing.session_id) {
        await db.sessions.delete(existing.session_id).catch(() => {});
      }
      await db.runningCompletions.uncomplete(run.week, run.runNumber);
      setChecking(null);
    } else {
      // Check: pick date (default today), create workout session, save completion
      const date = dateInputs[k] || todayStr();
      setChecking(k);

      // Create a workout session of type "running"
      const sessionId = uid();
      const sessionPayload = {
        id: sessionId,
        date,
        type: "running",
        notes: `Week ${run.week} – ${run.isLong ? "Long run" : "Easy run"}: ${run.label}`,
        cardio_data: { distance_miles: run.miles },
      };
      await db.sessions.upsert(sessionPayload);

      // Save completion
      const completion = await db.runningCompletions.complete({
        week: run.week,
        run_number: run.runNumber,
        completed_date: date,
        session_id: sessionId,
      }) as Completion;

      setCompletions(cs => [...cs, completion]);
      setChecking(null);
    }
  };

  // Group by week
  const weeks = Array.from({ length: 12 }, (_, i) => i + 1);

  const phaseLabel = (week: number) => {
    if (week <= 4) return "Base Building";
    if (week <= 8) return "Building toward 10K";
    return "Consolidate & Sharpen";
  };

  const phaseStart = [1, 5, 9];

  if (loading) {
    return <p className="text-xs text-gray-600 animate-pulse py-10 text-center">Loading…</p>;
  }

  const totalDone = completions.length;
  const currentWeek = Math.max(1, Math.ceil(totalDone / 2 + 0.5));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">🏃 10K Plan</h2>
        <div className="text-right">
          <p className="text-xs text-gray-500">Week {Math.min(currentWeek, 12)} of 12</p>
          <p className="text-xs text-gray-600">{totalDone} runs complete</p>
        </div>
      </div>

      <RunGraph completions={completions} />

      {/* Week list */}
      <div className="flex flex-col gap-3">
        {weeks.map(week => {
          const weekRuns = PLAN.filter(r => r.week === week);
          const isCutback = weekRuns[0].isCutback;
          const isRaceWeek = week === 12;
          const showPhaseHeader = phaseStart.includes(week);
          const phase = phaseLabel(week);

          return (
            <div key={week}>
              {showPhaseHeader && (
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-2 mt-2">{phase}</p>
              )}
              <div className={`bg-[#1e1e1e] border rounded-2xl overflow-hidden ${isCutback ? "border-yellow-900/40" : isRaceWeek ? "border-green-900/40" : "border-[#2e2e2e]"}`}>
                {/* Week header */}
                <div className={`flex items-center justify-between px-5 py-3 border-b ${isCutback ? "border-yellow-900/30 bg-yellow-900/10" : isRaceWeek ? "border-green-900/30 bg-green-900/10" : "border-[#252525]"}`}>
                  <span className="text-xs font-semibold text-white">Week {week}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${isCutback ? "bg-yellow-900/40 text-yellow-400" : isRaceWeek ? "bg-green-900/40 text-green-400" : "text-gray-600"}`}>
                    {isCutback ? "Cutback" : isRaceWeek ? "Race Week 🏁" : ""}
                  </span>
                </div>

                {/* Runs */}
                {weekRuns.map(run => {
                  const done = isDone(run.week, run.runNumber);
                  const k = key(run.week, run.runNumber);
                  const isLoading = checking === k;

                  return (
                    <div
                      key={k}
                      className={`flex items-center gap-4 px-5 py-3.5 ${run.runNumber === 1 ? "border-b border-[#1a1a1a]" : ""}`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => !isLoading && toggleRun(run)}
                        disabled={isLoading}
                        className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all ${
                          done
                            ? run.isLong ? "bg-blue-500 border-blue-500" : "bg-orange-500 border-orange-500"
                            : "border-[#444] hover:border-[#666]"
                        } ${isLoading ? "opacity-50" : ""}`}
                      >
                        {done && <span className="text-white text-[10px] font-bold">✓</span>}
                      </button>

                      {/* Run info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${run.isLong ? "text-blue-400" : "text-orange-400"}`}>
                            {run.isRace ? "🏁 Race" : run.isLong ? "Long" : "Easy"}
                          </span>
                          <span className={`text-sm ${done ? "text-gray-500 line-through" : "text-gray-200"}`}>
                            {run.label}
                          </span>
                        </div>
                        {done && (
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            Logged {done.completed_date} · added to workouts
                          </p>
                        )}
                      </div>

                      {/* Miles badge */}
                      <span className={`text-xs font-semibold tabular-nums ${done ? "text-gray-600" : run.isLong ? "text-blue-400" : "text-orange-400"}`}>
                        {run.miles}mi
                      </span>

                      {/* Date picker (shows when not done) */}
                      {!done && (
                        <input
                          type="date"
                          value={dateInputs[k] || todayStr()}
                          onChange={e => setDateInputs(d => ({ ...d, [k]: e.target.value }))}
                          onClick={e => e.stopPropagation()}
                          className="bg-[#252525] border border-[#333] rounded-lg px-2 py-1 text-xs text-gray-400 focus:outline-none focus:border-blue-500 w-32"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tips */}
      <div className="mt-6 bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-5">
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Keys to success</p>
        <div className="space-y-2 text-xs text-gray-500 leading-relaxed">
          <p><span className="text-gray-300">Easy means easy.</span> Run 1 should be conversational — you should be able to hold a sentence without gasping.</p>
          <p><span className="text-gray-300">Don't skip cutback weeks.</span> They're where adaptation actually happens.</p>
          <p><span className="text-gray-300">Time over pace on long runs.</span> Cover the distance, don't worry about speed.</p>
          <p><span className="text-gray-300">Repeat weeks if needed.</span> Better to stay than push into injury.</p>
        </div>
      </div>
    </div>
  );
}
