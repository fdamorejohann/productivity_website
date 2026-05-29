import { useState, useEffect, useRef } from "react";
import { db } from "../lib/db";

const uid = () => crypto.randomUUID();
const todayStr = () => new Date().toISOString().slice(0, 10);

// ─── Types ────────────────────────────────────────────────────────────────────

interface Exercise {
  id: string;
  name: string;
  category: string;
}

interface WorkoutSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight_lbs: number | null;
  reps: number | null;
  exercises?: { name: string };
}

interface Session {
  id: string;
  date: string;
  notes: string;
  workout_sets: WorkoutSet[];
}

// Draft set used while logging (before saving)
interface DraftSet {
  id: string;
  weight_lbs: string;
  reps: string;
}

interface DraftExercise {
  exercise_id: string;
  exercise_name: string;
  sets: DraftSet[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const epley1RM = (weight: number, reps: number) =>
  reps === 1 ? weight : Math.round(weight * (1 + reps / 30));

const maxWeightForExercise = (sets: WorkoutSet[]) => {
  const vals = sets.map(s => s.weight_lbs ?? 0);
  return vals.length ? Math.max(...vals) : 0;
};

const best1RMForSession = (sets: WorkoutSet[]) => {
  return sets.reduce((best, s) => {
    if (!s.weight_lbs || !s.reps) return best;
    return Math.max(best, epley1RM(s.weight_lbs, s.reps));
  }, 0);
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

// ─── WorkoutPanel ─────────────────────────────────────────────────────────────

export default function WorkoutPanel() {
  const [tab, setTab] = useState<"log" | "history" | "progress">("log");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      db.sessions.list(),
      db.exercises.list(),
    ]).then(([s, e]) => {
      setSessions(s as Session[]);
      setExercises(e as Exercise[]);
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">⚔️ Workouts</h1>
          <p className="text-xs text-gray-500 mt-1">{sessions.length} sessions logged</p>
        </div>
        <div className="flex gap-2">
          {(["log", "history", "progress"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t ? "bg-white text-black" : "text-gray-400 hover:text-white border border-[#2e2e2e]"
              }`}
            >{t}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-600 text-sm animate-pulse">Loading…</p>
      ) : (
        <>
          {tab === "log" && (
            <LogTab
              exercises={exercises}
              sessions={sessions}
              onSaved={(s, e) => { setSessions(prev => [s, ...prev.filter(x => x.id !== s.id)]); setExercises(e); }}
            />
          )}
          {tab === "history" && (
            <HistoryTab sessions={sessions} onDelete={id => setSessions(prev => prev.filter(s => s.id !== id))} />
          )}
          {tab === "progress" && (
            <ProgressTab sessions={sessions} exercises={exercises} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Log Tab ──────────────────────────────────────────────────────────────────

function LogTab({ exercises, sessions, onSaved }: {
  exercises: Exercise[];
  sessions: Session[];
  onSaved: (session: Session, exercises: Exercise[]) => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Find previous weights for an exercise
  const prevWeights = (exerciseId: string) => {
    for (const s of sessions) {
      const sets = s.workout_sets.filter(st => st.exercise_id === exerciseId);
      if (sets.length) return sets;
    }
    return [];
  };

  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const addExercise = async (ex: Exercise | null, name?: string) => {
    let exercise = ex;
    if (!exercise && name) {
      const newEx = await db.exercises.upsert({ id: uid(), name: name.trim(), category: "other" }) as Exercise;
      exercise = newEx;
      exercises.push(newEx); // local ref update handled by onSaved
    }
    if (!exercise) return;
    setDraftExercises(prev => [...prev, {
      exercise_id: exercise!.id,
      exercise_name: exercise!.name,
      sets: [{ id: uid(), weight_lbs: "", reps: "" }],
    }]);
    setSearch("");
    setShowDropdown(false);
  };

  const updateSet = (exIdx: number, setIdx: number, field: "weight_lbs" | "reps", val: string) => {
    setDraftExercises(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e,
      sets: e.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: val }),
    }));
  };

  const addSet = (exIdx: number) => {
    setDraftExercises(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e,
      sets: [...e.sets, { id: uid(), weight_lbs: "", reps: "" }],
    }));
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setDraftExercises(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e,
      sets: e.sets.filter((_, j) => j !== setIdx),
    }));
  };

  const removeExercise = (exIdx: number) => {
    setDraftExercises(prev => prev.filter((_, i) => i !== exIdx));
  };

  const saveWorkout = async () => {
    if (draftExercises.length === 0) return;
    setSaving(true);
    const session = await db.sessions.upsert({ id: uid(), date, notes }) as Session;

    const allSets: WorkoutSet[] = [];
    const allExercises = [...exercises];

    for (const de of draftExercises) {
      for (let i = 0; i < de.sets.length; i++) {
        const s = de.sets[i];
        const set = await db.sets.upsert({
          id: uid(),
          session_id: session.id,
          exercise_id: de.exercise_id,
          set_number: i + 1,
          weight_lbs: s.weight_lbs ? parseFloat(s.weight_lbs) : null,
          reps: s.reps ? parseInt(s.reps) : null,
        }) as WorkoutSet;
        allSets.push({ ...set, exercises: { name: de.exercise_name } });
      }
    }

    const fullSession: Session = { ...session, workout_sets: allSets };
    onSaved(fullSession, allExercises);
    setDraftExercises([]);
    setNotes("");
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      {/* Date + notes */}
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Date</p>
            <input
              type="date"
              className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p>
            <input
              className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
              placeholder="e.g. felt strong, slight shoulder tightness…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Draft exercises */}
      {draftExercises.map((de, exIdx) => {
        const prev = prevWeights(de.exercise_id);
        return (
          <div key={de.exercise_id + exIdx} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">{de.exercise_name}</h3>
              <button onClick={() => removeExercise(exIdx)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Remove</button>
            </div>

            {/* Set headers */}
            <div className="grid grid-cols-[40px_1fr_1fr_32px] gap-2 mb-2">
              <span className="text-xs text-gray-600">Set</span>
              <span className="text-xs text-gray-600">Weight (lbs)</span>
              <span className="text-xs text-gray-600">Reps</span>
              <span />
            </div>

            {de.sets.map((s, setIdx) => {
              const prevSet = prev[setIdx];
              return (
                <div key={s.id} className="grid grid-cols-[40px_1fr_1fr_32px] gap-2 mb-2 items-center">
                  <span className="text-xs text-gray-500">{setIdx + 1}</span>
                  <input
                    type="number"
                    className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full"
                    placeholder={prevSet?.weight_lbs ? String(prevSet.weight_lbs) : "0"}
                    value={s.weight_lbs}
                    onChange={e => updateSet(exIdx, setIdx, "weight_lbs", e.target.value)}
                  />
                  <input
                    type="number"
                    className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full"
                    placeholder={prevSet?.reps ? String(prevSet.reps) : "0"}
                    value={s.reps}
                    onChange={e => updateSet(exIdx, setIdx, "reps", e.target.value)}
                  />
                  <button onClick={() => removeSet(exIdx, setIdx)} className="text-gray-600 hover:text-red-400 text-lg leading-none transition-colors">×</button>
                </div>
              );
            })}

            <button onClick={() => addSet(exIdx)} className="text-xs text-gray-500 hover:text-white border border-[#333] rounded-lg px-3 py-1.5 mt-1 transition-colors">
              + Add Set
            </button>
          </div>
        );
      })}

      {/* Exercise search */}
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Add Exercise</p>
        <div className="relative">
          <input
            ref={searchRef}
            className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
            placeholder="Search exercises or type new…"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
            onFocus={() => setShowDropdown(true)}
          />
          {showDropdown && search.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-[#252525] border border-[#333] rounded-xl overflow-hidden shadow-xl">
              {filtered.map(ex => (
                <button
                  key={ex.id}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-[#333] transition-colors"
                  onMouseDown={() => addExercise(ex)}
                >
                  {ex.name}
                  <span className="text-xs text-gray-500 ml-2">{ex.category}</span>
                </button>
              ))}
              {!filtered.find(e => e.name.toLowerCase() === search.toLowerCase()) && (
                <button
                  className="w-full text-left px-4 py-2.5 text-sm text-blue-400 hover:bg-[#333] border-t border-[#333] transition-colors"
                  onMouseDown={() => addExercise(null, search)}
                >
                  + Create "{search}"
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quick picks from recent */}
        {exercises.length > 0 && search.length === 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {exercises.slice(0, 8).map(ex => (
              <button
                key={ex.id}
                onClick={() => addExercise(ex)}
                className="text-xs text-gray-400 hover:text-white border border-[#2e2e2e] hover:border-[#444] rounded-lg px-3 py-1.5 transition-colors"
              >
                {ex.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      {draftExercises.length > 0 && (
        <button
          onClick={saveWorkout}
          disabled={saving}
          className="w-full bg-white text-black py-3 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Workout"}
        </button>
      )}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ sessions, onDelete }: { sessions: Session[]; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (sessions.length === 0) {
    return <p className="text-gray-600 text-sm">No workouts logged yet.</p>;
  }

  return (
    <div className="space-y-3">
      {sessions.map(s => {
        const exerciseNames = [...new Set(s.workout_sets.map(st => st.exercises?.name).filter(Boolean))];
        const isOpen = expanded === s.id;
        return (
          <div key={s.id} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#242424] transition-colors"
              onClick={() => setExpanded(isOpen ? null : s.id)}
            >
              <div className="text-left">
                <p className="text-white font-medium text-sm">{formatDate(s.date)}</p>
                <p className="text-xs text-gray-500 mt-0.5">{exerciseNames.join(" · ") || "No exercises"}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{s.workout_sets.length} sets</span>
                <span className="text-gray-600">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 border-t border-[#2a2a2a]">
                {s.notes && <p className="text-xs text-gray-500 mt-3 mb-4 italic">{s.notes}</p>}
                {exerciseNames.map(name => {
                  const exSets = s.workout_sets.filter(st => st.exercises?.name === name);
                  const maxW = maxWeightForExercise(exSets);
                  const best1rm = best1RMForSession(exSets);
                  return (
                    <div key={name} className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-white">{name}</p>
                        <div className="flex gap-3">
                          <span className="text-xs text-gray-500">Max <span className="text-white">{maxW} lbs</span></span>
                          <span className="text-xs text-gray-500">1RM est. <span className="text-blue-400">{best1rm} lbs</span></span>
                        </div>
                      </div>
                      <div className="grid grid-cols-[40px_1fr_1fr] gap-2">
                        <span className="text-xs text-gray-600">Set</span>
                        <span className="text-xs text-gray-600">Weight</span>
                        <span className="text-xs text-gray-600">Reps</span>
                        {exSets.map((st, i) => (
                          <>
                            <span key={st.id + "n"} className="text-xs text-gray-500">{i + 1}</span>
                            <span key={st.id + "w"} className="text-xs text-white">{st.weight_lbs ?? "—"} lbs</span>
                            <span key={st.id + "r"} className="text-xs text-white">{st.reps ?? "—"} reps</span>
                          </>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={async () => { await db.sessions.delete(s.id); onDelete(s.id); }}
                  className="mt-5 text-xs text-gray-600 hover:text-red-400 transition-colors"
                >
                  Delete session
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Progress Tab ─────────────────────────────────────────────────────────────

function ProgressTab({ sessions, exercises }: { sessions: Session[]; exercises: Exercise[] }) {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [view, setView] = useState<"overview" | "lift">("overview");

  // Build per-exercise history: { exerciseId -> [{date, maxWeight, best1RM}] }
  const exerciseHistory = () => {
    const map = new Map<string, { date: string; maxWeight: number; best1RM: number }[]>();
    const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
    for (const s of sorted) {
      const byEx = new Map<string, WorkoutSet[]>();
      for (const st of s.workout_sets) {
        if (!byEx.has(st.exercise_id)) byEx.set(st.exercise_id, []);
        byEx.get(st.exercise_id)!.push(st);
      }
      byEx.forEach((sets, exId) => {
        if (!map.has(exId)) map.set(exId, []);
        map.get(exId)!.push({
          date: s.date,
          maxWeight: maxWeightForExercise(sets),
          best1RM: best1RMForSession(sets),
        });
      });
    }
    return map;
  };

  const history = exerciseHistory();

  // Overview: normalized % of personal best per exercise
  const renderOverview = () => {
    const entries = [...history.entries()].filter(([, pts]) => pts.length >= 2);
    if (entries.length === 0) return <p className="text-gray-600 text-sm">Log at least 2 sessions per exercise to see trends.</p>;

    const allDates = [...new Set(sessions.map(s => s.date))].sort();
    const H = 160;
    const W = 560;
    const colors = ["#3b82f6","#22c55e","#a78bfa","#f59e0b","#ec4899","#06b6d4","#f97316","#84cc16"];

    return (
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">All Lifts — Normalized Progress</p>
        <p className="text-xs text-gray-600 mb-4">Each line = % of personal best (max weight). 100% = your all-time best set.</p>
        <div className="relative overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" style={{ minWidth: "320px" }}>
            {/* Y axis labels */}
            {[0, 50, 100].map(pct => (
              <text key={pct} x="0" y={H - (pct / 100) * (H - 10) + 4} fill="#555" fontSize="9">{pct}%</text>
            ))}
            {/* Lines */}
            {entries.map(([exId, pts], idx) => {
              const maxW = Math.max(...pts.map(p => p.maxWeight));
              if (maxW === 0) return null;
              const color = colors[idx % colors.length];
              const exName = exercises.find(e => e.id === exId)?.name ?? exId;
              const pointsStr = pts.map(p => {
                const dateIdx = allDates.indexOf(p.date);
                const x = allDates.length <= 1 ? W / 2 : 24 + (dateIdx / (allDates.length - 1)) * (W - 24);
                const y = H - ((p.maxWeight / maxW) * (H - 10));
                return `${x},${y}`;
              }).join(" ");
              return (
                <g key={exId}>
                  <polyline points={pointsStr} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {pts.map((p, i) => {
                    const dateIdx = allDates.indexOf(p.date);
                    const x = allDates.length <= 1 ? W / 2 : 24 + (dateIdx / (allDates.length - 1)) * (W - 24);
                    const y = H - ((p.maxWeight / maxW) * (H - 10));
                    return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
                  })}
                  {/* Label at last point */}
                  {(() => {
                    const last = pts[pts.length - 1];
                    const dateIdx = allDates.indexOf(last.date);
                    const x = allDates.length <= 1 ? W / 2 : 24 + (dateIdx / (allDates.length - 1)) * (W - 24);
                    const y = H - ((last.maxWeight / maxW) * (H - 10));
                    return <text x={Math.min(x + 5, W - 60)} y={y + 4} fill={color} fontSize="9">{exName}</text>;
                  })()}
                </g>
              );
            })}
          </svg>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {entries.map(([exId], idx) => {
            const exName = exercises.find(e => e.id === exId)?.name ?? exId;
            return (
              <button
                key={exId}
                onClick={() => { setSelectedExercise(exId); setView("lift"); }}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[idx % colors.length] }} />
                {exName}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderLift = () => {
    const pts = selectedExercise ? history.get(selectedExercise) ?? [] : [];
    const exName = exercises.find(e => e.id === selectedExercise)?.name ?? "—";
    const maxW = pts.length ? Math.max(...pts.map(p => p.maxWeight)) : 1;
    const best1RM = pts.length ? Math.max(...pts.map(p => p.best1RM)) : 0;
    const firstW = pts[0]?.maxWeight ?? 0;
    const lastW = pts[pts.length - 1]?.maxWeight ?? 0;
    const H = 140;
    const W = 560;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-sm text-gray-500 hover:text-white transition-colors">← Overview</button>
          <select
            className="bg-[#252525] border border-[#333] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
            value={selectedExercise ?? ""}
            onChange={e => setSelectedExercise(e.target.value)}
          >
            {[...history.keys()].map(exId => (
              <option key={exId} value={exId}>{exercises.find(e => e.id === exId)?.name ?? exId}</option>
            ))}
          </select>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Best set", value: `${maxW} lbs` },
            { label: "Est. 1RM", value: `${best1RM} lbs` },
            { label: "Progress", value: firstW ? `+${lastW - firstW} lbs` : "—" },
            { label: "Sessions", value: String(pts.length) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-lg font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">{exName} — Max weight per session</p>
          {pts.length < 2 ? (
            <p className="text-gray-600 text-sm">Need at least 2 sessions to show a trend.</p>
          ) : (
            <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                const y = H - pct * (H - 10);
                const val = Math.round(pct * maxW);
                return (
                  <g key={pct}>
                    <line x1="30" y1={y} x2={W} y2={y} stroke="#2a2a2a" strokeWidth="1" />
                    <text x="0" y={y + 4} fill="#555" fontSize="9">{val}</text>
                  </g>
                );
              })}
              {/* Line */}
              {(() => {
                const pointsStr = pts.map((p, i) => {
                  const x = 30 + (i / (pts.length - 1)) * (W - 30);
                  const y = H - (p.maxWeight / maxW) * (H - 10);
                  return `${x},${y}`;
                }).join(" ");
                return (
                  <>
                    <polyline points={pointsStr} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {pts.map((p, i) => {
                      const x = 30 + (i / (pts.length - 1)) * (W - 30);
                      const y = H - (p.maxWeight / maxW) * (H - 10);
                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r="4" fill="#3b82f6" />
                          <text x={x} y={H + 20} fill="#555" fontSize="9" textAnchor="middle">
                            {new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </text>
                        </g>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          )}
        </div>

        {/* Session breakdown */}
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Session History</p>
          <div className="space-y-2">
            {[...pts].reverse().map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0">
                <span className="text-sm text-gray-400">{formatDate(p.date)}</span>
                <div className="flex gap-4">
                  <span className="text-xs text-gray-500">Max <span className="text-white">{p.maxWeight} lbs</span></span>
                  <span className="text-xs text-gray-500">1RM <span className="text-blue-400">{p.best1RM} lbs</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (sessions.length === 0) return <p className="text-gray-600 text-sm">No workouts logged yet.</p>;

  return (
    <div>
      {view === "overview" && renderOverview()}
      {view === "lift" && renderLift()}
      {view === "overview" && history.size > 0 && (
        <div className="mt-5 bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Drill Into a Lift</p>
          <div className="flex flex-wrap gap-2">
            {[...history.keys()].map(exId => (
              <button
                key={exId}
                onClick={() => { setSelectedExercise(exId); setView("lift"); }}
                className="text-xs text-gray-400 hover:text-white border border-[#2e2e2e] hover:border-[#444] rounded-lg px-3 py-1.5 transition-colors"
              >
                {exercises.find(e => e.id === exId)?.name ?? exId}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
