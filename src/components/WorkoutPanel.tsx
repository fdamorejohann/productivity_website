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
  is_amrap: boolean;
  exercises?: { name: string };
}

type WorkoutType = "lifting" | "running" | "rollerblading" | "muaythai" | "biking";

interface CardioData {
  duration_min?: number;
  distance_miles?: number;
  elevation_ft?: number;
  rounds?: number;
  avg_pace?: string;
}

interface Session {
  id: string;
  date: string;
  notes: string;
  type: WorkoutType;
  cardio_data?: CardioData;
  workout_sets: WorkoutSet[];
}

const WORKOUT_COLORS: Record<string, string> = {
  lifting: "#ef4444",
  running: "#f97316",
  rollerblading: "#a78bfa",
  muaythai: "#ec4899",
  biking: "#3b82f6",
};

const WORKOUT_TYPES: { key: WorkoutType; label: string; emoji: string; color: string }[] = [
  { key: "lifting",       label: "Lifting",       emoji: "🏋️",  color: "#ef4444" },
  { key: "running",       label: "Running",       emoji: "🏃",  color: "#f97316" },
  { key: "rollerblading", label: "Rollerblading", emoji: "🛼",  color: "#a78bfa" },
  { key: "muaythai",      label: "Muay Thai",     emoji: "🥊",  color: "#ec4899" },
  { key: "biking",        label: "Biking",        emoji: "🚴",  color: "#3b82f6" },
];

// Draft set used while logging
interface DraftSet {
  id: string;
  weight_lbs: string;
  reps: string;
  is_amrap: boolean;
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
  const vals = sets.filter(s => !s.is_amrap).map(s => s.weight_lbs ?? 0);
  return vals.length ? Math.max(...vals) : 0;
};

const maxRepsForExercise = (sets: WorkoutSet[]) => {
  const vals = sets.map(s => s.reps ?? 0);
  return vals.length ? Math.max(...vals) : 0;
};

const best1RMForSession = (sets: WorkoutSet[]) => {
  return sets.filter(s => !s.is_amrap).reduce((best, s) => {
    if (!s.weight_lbs || !s.reps) return best;
    return Math.max(best, epley1RM(s.weight_lbs, s.reps));
  }, 0);
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function typeInfo(type: WorkoutType) {
  return WORKOUT_TYPES.find(t => t.key === type) ?? WORKOUT_TYPES[0];
}

// ─── WorkoutPanel ─────────────────────────────────────────────────────────────

export default function WorkoutPanel() {
  const [tab, setTab] = useState<"log" | "history" | "progress">("progress");
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
          {(["progress", "log", "history"] as const).map(t => (
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
            <HistoryTab
              sessions={sessions}
              exercises={exercises}
              onDelete={id => setSessions(prev => prev.filter(s => s.id !== id))}
              onUpdate={updated => setSessions(prev => prev.map(s => s.id === updated.id ? updated : s))}
            />
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
  const [workoutType, setWorkoutType] = useState<WorkoutType>("lifting");
  const [cardioData, setCardioData] = useState<CardioData>({});
  const [draftExercises, setDraftExercises] = useState<DraftExercise[]>([]);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const isLifting = workoutType === "lifting";

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
      exercises.push(newEx);
    }
    if (!exercise) return;
    setDraftExercises(prev => [...prev, {
      exercise_id: exercise!.id,
      exercise_name: exercise!.name,
      sets: [{ id: uid(), weight_lbs: "", reps: "", is_amrap: false }],
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

  const toggleAmrap = (exIdx: number, setIdx: number) => {
    setDraftExercises(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e,
      sets: e.sets.map((s, j) => j !== setIdx ? s : { ...s, is_amrap: !s.is_amrap, weight_lbs: "" }),
    }));
  };

  const addSet = (exIdx: number) => {
    setDraftExercises(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e,
      sets: [...e.sets, { id: uid(), weight_lbs: "", reps: "", is_amrap: false }],
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

  const canSave = isLifting ? draftExercises.length > 0 : (
    (cardioData.duration_min ?? 0) > 0 ||
    (cardioData.distance_miles ?? 0) > 0 ||
    (cardioData.rounds ?? 0) > 0
  );

  const saveWorkout = async () => {
    if (!canSave) return;
    setSaving(true);
    const session = await db.sessions.upsert({
      id: uid(),
      date,
      notes,
      type: workoutType,
      cardio_data: isLifting ? null : cardioData,
    }) as Session;

    const allSets: WorkoutSet[] = [];
    const allExercises = [...exercises];

    if (isLifting) {
      for (const de of draftExercises) {
        for (let i = 0; i < de.sets.length; i++) {
          const s = de.sets[i];
          const set = await db.sets.upsert({
            id: uid(),
            session_id: session.id,
            exercise_id: de.exercise_id,
            set_number: i + 1,
            weight_lbs: (!s.is_amrap && s.weight_lbs) ? parseFloat(s.weight_lbs) : null,
            reps: s.reps ? parseInt(s.reps) : null,
            is_amrap: s.is_amrap,
          }) as WorkoutSet;
          allSets.push({ ...set, exercises: { name: de.exercise_name } });
        }
      }
    }

    const fullSession: Session = { ...session, type: workoutType, cardio_data: isLifting ? undefined : cardioData, workout_sets: allSets };
    onSaved(fullSession, allExercises);
    setDraftExercises([]);
    setNotes("");
    setCardioData({});
    setSaving(false);
  };

  const t = typeInfo(workoutType);

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

        {/* Type selector */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Workout Type</p>
          <div className="flex flex-wrap gap-2">
            {WORKOUT_TYPES.map(wt => (
              <button
                key={wt.key}
                onClick={() => setWorkoutType(wt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                  workoutType === wt.key
                    ? "text-black font-medium border-transparent"
                    : "text-gray-400 border-[#333] hover:border-[#555] hover:text-white"
                }`}
                style={workoutType === wt.key ? { backgroundColor: wt.color } : {}}
              >
                <span>{wt.emoji}</span>
                <span>{wt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cardio form */}
      {!isLifting && (
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5" style={{ borderColor: t.color + "44" }}>
          <p className="text-xs uppercase tracking-wider mb-4" style={{ color: t.color }}>{t.emoji} {t.label} Details</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Duration (min)</p>
              <input
                type="number"
                className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                placeholder="45"
                value={cardioData.duration_min ?? ""}
                onChange={e => setCardioData(p => ({ ...p, duration_min: e.target.value ? parseFloat(e.target.value) : undefined }))}
              />
            </div>
            {(workoutType === "running" || workoutType === "rollerblading" || workoutType === "biking") && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Distance (miles)</p>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  placeholder="3.1"
                  value={cardioData.distance_miles ?? ""}
                  onChange={e => setCardioData(p => ({ ...p, distance_miles: e.target.value ? parseFloat(e.target.value) : undefined }))}
                />
              </div>
            )}
            {workoutType === "running" && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Avg Pace (min/mi)</p>
                <input
                  type="text"
                  className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  placeholder="9:30"
                  value={cardioData.avg_pace ?? ""}
                  onChange={e => setCardioData(p => ({ ...p, avg_pace: e.target.value || undefined }))}
                />
              </div>
            )}
            {workoutType === "muaythai" && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Rounds</p>
                <input
                  type="number"
                  className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  placeholder="6"
                  value={cardioData.rounds ?? ""}
                  onChange={e => setCardioData(p => ({ ...p, rounds: e.target.value ? parseInt(e.target.value) : undefined }))}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Draft exercises (lifting only) */}
      {isLifting && draftExercises.map((de, exIdx) => {
        const prev = prevWeights(de.exercise_id);
        return (
          <div key={de.exercise_id + exIdx} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">{de.exercise_name}</h3>
              <button onClick={() => removeExercise(exIdx)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Remove</button>
            </div>

            {/* Set headers */}
            <div className="grid grid-cols-[40px_1fr_1fr_80px_32px] gap-2 mb-2">
              <span className="text-xs text-gray-600">Set</span>
              <span className="text-xs text-gray-600">Weight (lbs)</span>
              <span className="text-xs text-gray-600">Reps</span>
              <span className="text-xs text-gray-600 text-center">AMRAP</span>
              <span />
            </div>

            {de.sets.map((s, setIdx) => {
              const prevSet = prev[setIdx];
              return (
                <div key={s.id} className="grid grid-cols-[40px_1fr_1fr_80px_32px] gap-2 mb-2 items-center">
                  <span className="text-xs text-gray-500">{setIdx + 1}</span>
                  <input
                    type="number"
                    className={`bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full transition-opacity ${s.is_amrap ? "opacity-30 pointer-events-none" : ""}`}
                    placeholder={prevSet?.weight_lbs ? String(prevSet.weight_lbs) : "0"}
                    value={s.weight_lbs}
                    onChange={e => updateSet(exIdx, setIdx, "weight_lbs", e.target.value)}
                    disabled={s.is_amrap}
                  />
                  <input
                    type="number"
                    className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none w-full"
                    placeholder={prevSet?.reps ? String(prevSet.reps) : "0"}
                    value={s.reps}
                    onChange={e => updateSet(exIdx, setIdx, "reps", e.target.value)}
                  />
                  <div className="flex justify-center">
                    <button
                      onClick={() => toggleAmrap(exIdx, setIdx)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${s.is_amrap ? "bg-purple-500" : "bg-[#333]"}`}
                      title="AMRAP — track max reps, no weight"
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${s.is_amrap ? "left-4" : "left-0.5"}`} />
                    </button>
                  </div>
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

      {/* Exercise search (lifting only) */}
      {isLifting && (
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
      )}

      {/* Save */}
      {canSave && (
        <button
          onClick={saveWorkout}
          disabled={saving}
          className="w-full py-3 rounded-xl font-medium transition-colors disabled:opacity-50 text-black"
          style={{ backgroundColor: t.color }}
        >
          {saving ? "Saving…" : `Save ${t.label} Workout`}
        </button>
      )}
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

interface EditSet { id: string; weight_lbs: string; reps: string; is_amrap: boolean; isNew?: boolean; }
interface EditExercise { exercise_id: string; exercise_name: string; sets: EditSet[]; }

function HistoryTab({ sessions, onDelete, onUpdate, exercises }: {
  sessions: Session[];
  onDelete: (id: string) => void;
  onUpdate: (session: Session) => void;
  exercises: Exercise[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editExercises, setEditExercises] = useState<EditExercise[]>([]);
  const [saving, setSaving] = useState(false);
  const [exSearch, setExSearch] = useState("");
  const [showExDropdown, setShowExDropdown] = useState(false);

  const startEdit = (s: Session) => {
    setEditing(s.id);
    setEditNotes(s.notes);
    setEditDate(s.date);
    const byEx = new Map<string, EditExercise>();
    for (const st of s.workout_sets) {
      const key = st.exercise_id;
      if (!byEx.has(key)) byEx.set(key, { exercise_id: key, exercise_name: st.exercises?.name ?? key, sets: [] });
      byEx.get(key)!.sets.push({ id: st.id, weight_lbs: String(st.weight_lbs ?? ""), reps: String(st.reps ?? ""), is_amrap: st.is_amrap });
    }
    setEditExercises([...byEx.values()]);
  };

  const updateEditSet = (exIdx: number, setIdx: number, field: "weight_lbs" | "reps", val: string) => {
    setEditExercises(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e, sets: e.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: val }),
    }));
  };

  const toggleEditAmrap = (exIdx: number, setIdx: number) => {
    setEditExercises(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e, sets: e.sets.map((s, j) => j !== setIdx ? s : { ...s, is_amrap: !s.is_amrap, weight_lbs: "" }),
    }));
  };

  const addEditSet = (exIdx: number) => {
    setEditExercises(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e, sets: [...e.sets, { id: uid(), weight_lbs: "", reps: "", is_amrap: false, isNew: true }],
    }));
  };

  const removeEditSet = async (exIdx: number, setIdx: number) => {
    const s = editExercises[exIdx].sets[setIdx];
    if (!s.isNew) await db.sets.delete(s.id);
    setEditExercises(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e, sets: e.sets.filter((_, j) => j !== setIdx),
    }));
  };

  const removeEditExercise = async (exIdx: number) => {
    const ex = editExercises[exIdx];
    for (const s of ex.sets) if (!s.isNew) await db.sets.delete(s.id);
    setEditExercises(prev => prev.filter((_, i) => i !== exIdx));
  };

  const addEditExercise = (ex: Exercise) => {
    if (editExercises.find(e => e.exercise_id === ex.id)) return;
    setEditExercises(prev => [...prev, { exercise_id: ex.id, exercise_name: ex.name, sets: [{ id: uid(), weight_lbs: "", reps: "", is_amrap: false, isNew: true }] }]);
    setExSearch(""); setShowExDropdown(false);
  };

  const saveEdit = async (s: Session) => {
    setSaving(true);
    await db.sessions.upsert({ id: s.id, date: editDate, notes: editNotes, type: s.type, cardio_data: s.cardio_data });
    const allSets: WorkoutSet[] = [];
    for (const de of editExercises) {
      for (let i = 0; i < de.sets.length; i++) {
        const st = de.sets[i];
        const saved = await db.sets.upsert({
          id: st.id,
          session_id: s.id,
          exercise_id: de.exercise_id,
          set_number: i + 1,
          weight_lbs: (!st.is_amrap && st.weight_lbs) ? parseFloat(st.weight_lbs) : null,
          reps: st.reps ? parseInt(st.reps) : null,
          is_amrap: st.is_amrap,
        }) as WorkoutSet;
        allSets.push({ ...saved, exercises: { name: de.exercise_name } });
      }
    }
    onUpdate({ ...s, date: editDate, notes: editNotes, workout_sets: allSets });
    setEditing(null);
    setSaving(false);
  };

  const filteredEx = exercises.filter(e => e.name.toLowerCase().includes(exSearch.toLowerCase()));


  if (sessions.length === 0) return (
    <div>
      <p className="text-gray-600 text-sm mb-4">No workouts logged yet.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Session list */}
      {sessions.map(s => {
        const t = typeInfo(s.type ?? "lifting");
        const exerciseNames = [...new Set(s.workout_sets.map(st => st.exercises?.name).filter(Boolean))];
        const isOpen = expanded === s.id;
        const isEditing = editing === s.id;
        const isLifting = (s.type ?? "lifting") === "lifting";

        return (
          <div key={s.id} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#242424] transition-colors"
              onClick={() => { setExpanded(isOpen ? null : s.id); if (isEditing) setEditing(null); }}
            >
              <div className="text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-medium text-sm">{formatDate(s.date)}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: t.color + "33", color: t.color }}>
                    {t.emoji} {t.label}
                  </span>
                  {s.notes && (
                    <span className="text-xs text-gray-400 italic">{s.notes}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isLifting
                    ? (exerciseNames.join(" · ") || "No exercises")
                    : formatCardioSummary(s.cardio_data, s.type)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isLifting && <span className="text-xs text-gray-500">{s.workout_sets.length} sets</span>}
                <span className="text-gray-600">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {isOpen && !isEditing && (
              <div className="px-5 pb-5 border-t border-[#2a2a2a]">
                {s.notes && <p className="text-xs text-gray-500 mt-3 mb-4 italic">{s.notes}</p>}

                {!isLifting && s.cardio_data && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {cardioFields(s.type, s.cardio_data).map(({ label, value }) => (
                      <div key={label} className="bg-[#252525] rounded-xl p-3">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-sm font-medium text-white mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {isLifting && exerciseNames.map(name => {
                  const exSets = s.workout_sets.filter(st => st.exercises?.name === name);
                  const maxW = maxWeightForExercise(exSets);
                  const best1rm = best1RMForSession(exSets);
                  const hasAmrap = exSets.some(st => st.is_amrap);
                  const maxReps = maxRepsForExercise(exSets.filter(st => st.is_amrap));
                  return (
                    <div key={name} className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-white">{name}</p>
                        <div className="flex gap-3">
                          {maxW > 0 && <span className="text-xs text-gray-500">Max <span className="text-white">{maxW} lbs</span></span>}
                          {best1rm > 0 && <span className="text-xs text-gray-500">1RM est. <span className="text-blue-400">{best1rm} lbs</span></span>}
                          {hasAmrap && <span className="text-xs text-gray-500">AMRAP best <span className="text-purple-400">{maxReps} reps</span></span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-[40px_1fr_1fr_60px] gap-2">
                        <span className="text-xs text-gray-600">Set</span>
                        <span className="text-xs text-gray-600">Weight</span>
                        <span className="text-xs text-gray-600">Reps</span>
                        <span className="text-xs text-gray-600">Type</span>
                        {exSets.map((st, i) => (
                          <>
                            <span key={st.id + "n"} className="text-xs text-gray-500">{i + 1}</span>
                            <span key={st.id + "w"} className="text-xs text-white">{st.is_amrap ? "—" : `${st.weight_lbs ?? "—"} lbs`}</span>
                            <span key={st.id + "r"} className="text-xs text-white">{st.reps ?? "—"} reps</span>
                            <span key={st.id + "t"} className="text-xs" style={{ color: st.is_amrap ? "#a78bfa" : "#6b7280" }}>{st.is_amrap ? "AMRAP" : "Weighted"}</span>
                          </>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="flex gap-4 mt-5">
                  <button onClick={() => startEdit(s)} className="text-xs text-gray-400 hover:text-white border border-[#333] rounded-lg px-3 py-1.5 transition-colors">Edit workout</button>
                  <button onClick={async () => { await db.sessions.delete(s.id); onDelete(s.id); }} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Delete</button>
                </div>
              </div>
            )}

            {isOpen && isEditing && (
              <div className="px-5 pb-5 border-t border-[#2a2a2a] space-y-4 pt-4">
                <div className="flex gap-3">
                  <input type="date" className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" value={editDate} onChange={e => setEditDate(e.target.value)} />
                  <input className="flex-1 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none" placeholder="Notes…" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                </div>

                {isLifting && editExercises.map((de, exIdx) => (
                  <div key={de.exercise_id + exIdx} className="bg-[#252525] border border-[#333] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-white">{de.exercise_name}</p>
                      <button onClick={() => removeEditExercise(exIdx)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Remove</button>
                    </div>
                    <div className="grid grid-cols-[32px_1fr_1fr_60px_28px] gap-2 mb-1">
                      <span className="text-xs text-gray-600">Set</span>
                      <span className="text-xs text-gray-600">Weight</span>
                      <span className="text-xs text-gray-600">Reps</span>
                      <span className="text-xs text-gray-600 text-center">AMRAP</span>
                      <span />
                    </div>
                    {de.sets.map((s, setIdx) => (
                      <div key={s.id} className="grid grid-cols-[32px_1fr_1fr_60px_28px] gap-2 mb-2 items-center">
                        <span className="text-xs text-gray-500">{setIdx + 1}</span>
                        <input type="number" className={`bg-[#1e1e1e] border border-[#333] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none w-full ${s.is_amrap ? "opacity-30" : ""}`} value={s.weight_lbs} onChange={e => updateEditSet(exIdx, setIdx, "weight_lbs", e.target.value)} placeholder="lbs" disabled={s.is_amrap} />
                        <input type="number" className="bg-[#1e1e1e] border border-[#333] rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none w-full" value={s.reps} onChange={e => updateEditSet(exIdx, setIdx, "reps", e.target.value)} placeholder="reps" />
                        <div className="flex justify-center">
                          <button
                            onClick={() => toggleEditAmrap(exIdx, setIdx)}
                            className={`w-9 h-5 rounded-full transition-colors relative ${s.is_amrap ? "bg-purple-500" : "bg-[#444]"}`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${s.is_amrap ? "left-4" : "left-0.5"}`} />
                          </button>
                        </div>
                        <button onClick={() => removeEditSet(exIdx, setIdx)} className="text-gray-600 hover:text-red-400 text-lg leading-none transition-colors">×</button>
                      </div>
                    ))}
                    <button onClick={() => addEditSet(exIdx)} className="text-xs text-gray-500 hover:text-white border border-[#333] rounded-lg px-3 py-1 mt-1 transition-colors">+ Set</button>
                  </div>
                ))}

                {isLifting && (
                  <div className="relative">
                    <input
                      className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
                      placeholder="Add exercise…"
                      value={exSearch}
                      onChange={e => { setExSearch(e.target.value); setShowExDropdown(true); }}
                      onFocus={() => setShowExDropdown(true)}
                    />
                    {showExDropdown && exSearch.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-[#252525] border border-[#333] rounded-xl overflow-hidden shadow-xl">
                        {filteredEx.map(ex => (
                          <button key={ex.id} className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-[#333] transition-colors" onMouseDown={() => addEditExercise(ex)}>
                            {ex.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => saveEdit(s)} disabled={saving} className="bg-white text-black px-5 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Save changes"}</button>
                  <button onClick={() => setEditing(null)} className="text-sm text-gray-500 hover:text-white transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Cardio helpers ───────────────────────────────────────────────────────────

function formatCardioSummary(data: CardioData | undefined, type: WorkoutType): string {
  if (!data) return "No data";
  const parts: string[] = [];
  if (data.duration_min) parts.push(`${data.duration_min} min`);
  if (data.distance_miles) parts.push(`${data.distance_miles} mi`);
  if (data.rounds) parts.push(`${data.rounds} rounds`);
  if (data.avg_pace) parts.push(`${data.avg_pace}/mi`);
  if (data.elevation_ft) parts.push(`${data.elevation_ft} ft gain`);
  if (parts.length === 0) return typeInfo(type).label;
  return parts.join(" · ");
}

function cardioFields(_type: WorkoutType, data: CardioData): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  if (data.duration_min) fields.push({ label: "Duration", value: `${data.duration_min} min` });
  if (data.distance_miles) fields.push({ label: "Distance", value: `${data.distance_miles} miles` });
  if (data.avg_pace) fields.push({ label: "Avg Pace", value: `${data.avg_pace} /mi` });
  if (data.elevation_ft) fields.push({ label: "Elevation", value: `${data.elevation_ft} ft` });
  if (data.rounds) fields.push({ label: "Rounds", value: String(data.rounds) });
  return fields;
}

// ─── Progress Tab ─────────────────────────────────────────────────────────────

function ProgressTab({ sessions, exercises }: { sessions: Session[]; exercises: Exercise[] }) {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [view, setView] = useState<"overview" | "lift" | "cardio">("overview");
  const [cardioType, setCardioType] = useState<WorkoutType>("running");

  // Monthly calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const workoutDateMap: Record<string, string[]> = {};
  for (const s of sessions) {
    const t = s.type ?? "lifting";
    if (!workoutDateMap[s.date]) workoutDateMap[s.date] = [];
    if (!workoutDateMap[s.date].includes(t)) workoutDateMap[s.date].push(t);
  }
  const calLabel = new Date(calYear, calMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const firstDay = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const calCells: { date: string; types: string[] }[] = [];
  for (let i = 0; i < startOffset; i++) calCells.push({ date: "", types: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    calCells.push({ date: ds, types: workoutDateMap[ds] ?? [] });
  }
  const monthSessions = sessions.filter(s => s.date.startsWith(`${calYear}-${String(calMonth + 1).padStart(2, "0")}`));

  const liftingSessions = sessions.filter(s => (s.type ?? "lifting") === "lifting");
  const cardioSessions = (type: WorkoutType) => sessions.filter(s => s.type === type && s.cardio_data);

  // Build per-exercise history
  const exerciseHistory = () => {
    const map = new Map<string, { date: string; maxWeight: number; best1RM: number; maxReps: number; isAmrap: boolean }[]>();
    const sorted = [...liftingSessions].sort((a, b) => a.date.localeCompare(b.date));
    for (const s of sorted) {
      const byEx = new Map<string, WorkoutSet[]>();
      for (const st of s.workout_sets) {
        if (!byEx.has(st.exercise_id)) byEx.set(st.exercise_id, []);
        byEx.get(st.exercise_id)!.push(st);
      }
      byEx.forEach((sets, exId) => {
        if (!map.has(exId)) map.set(exId, []);
        const hasWeight = sets.some(st => !st.is_amrap && st.weight_lbs);
        const amrapSets = sets.filter(st => st.is_amrap);
        map.get(exId)!.push({
          date: s.date,
          maxWeight: maxWeightForExercise(sets),
          best1RM: best1RMForSession(sets),
          maxReps: maxRepsForExercise(amrapSets),
          isAmrap: !hasWeight && amrapSets.length > 0,
        });
      });
    }
    return map;
  };

  const history = exerciseHistory();

  // Mini sparkline SVG for a card
  const Sparkline = ({ values, color, isAmrap }: { values: number[]; color: string; isAmrap: boolean }) => {
    if (values.length < 2) return <div className="h-10 flex items-end"><span className="text-xs text-gray-600">Not enough data</span></div>;
    const W = 120; const H = 36;
    const maxV = Math.max(...values);
    const minV = Math.min(...values);
    const range = maxV - minV || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - minV) / range) * (H - 4) - 2;
      return `${x},${y}`;
    }).join(" ");
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10">
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={isAmrap ? "3 2" : undefined} />
        {values.map((v, i) => {
          const x = (i / (values.length - 1)) * W;
          const y = H - ((v - minV) / range) * (H - 4) - 2;
          return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
        })}
      </svg>
    );
  };

  const renderOverview = () => {
    const liftingEntries = [...history.entries()].filter(([, pts]) => pts.some(p => p.maxWeight > 0));
    const amrapEntries = [...history.entries()].filter(([, pts]) => pts.every(p => p.isAmrap) && pts.some(p => p.maxReps > 0));
    const hasLifts = liftingEntries.length > 0;
    const hasAmrap = amrapEntries.length > 0;

    if (!hasLifts && !hasAmrap && cardioSessions("running").length + cardioSessions("biking").length + cardioSessions("rollerblading").length + cardioSessions("muaythai").length < 1) {
      return <p className="text-gray-600 text-sm">No workout data yet.</p>;
    }

    return (
      <div className="space-y-5">
        {/* Monthly calendar */}
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-3" style={{ width: 224 }}>
          <div className="flex items-center justify-between mb-1.5">
            <button onClick={() => { const d = new Date(calYear, calMonth - 1, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }} className="text-gray-500 hover:text-white w-5 h-5 flex items-center justify-center transition-colors text-xs">‹</button>
            <p className="text-[11px] font-medium text-white">{calLabel} <span className="text-gray-600 font-normal">· {monthSessions.length}</span></p>
            <button onClick={() => { const d = new Date(calYear, calMonth + 1, 1); if (d <= now) { setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); } }} className={`w-5 h-5 flex items-center justify-center transition-colors text-xs ${new Date(calYear, calMonth + 1, 1) > now ? "text-gray-700 cursor-default" : "text-gray-500 hover:text-white"}`}>›</button>
          </div>
          <div className="grid grid-cols-7 mb-0.5">
            {["M","T","W","T","F","S","S"].map((d, i) => (
              <div key={i} className="text-center text-[9px] text-gray-600">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {calCells.map((c, i) => {
              if (!c.date) return <div key={i} style={{ height: 28 }} />;
              const dayNum = parseInt(c.date.slice(8));
              const isToday = c.date === todayStr();
              const hasWorkout = c.types.length > 0;
              return (
                <div key={i} style={{ height: 28 }} className="flex flex-col items-center justify-center gap-px">
                  <span className={`text-[10px] leading-none ${isToday ? "font-bold text-white" : hasWorkout ? "text-gray-300" : "text-gray-600"}`}>{dayNum}</span>
                  {hasWorkout && (
                    <div className="flex gap-px">
                      {c.types.map(t => (
                        <span key={t} className="w-1 h-1 rounded-full" style={{ backgroundColor: WORKOUT_COLORS[t] ?? "#ef4444" }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-2">
            {Object.entries(WORKOUT_COLORS).map(([type, color]) => (
              <span key={type} className="flex items-center gap-1 text-[9px] text-gray-600 capitalize">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                {type === "muaythai" ? "Muay Thai" : type}
              </span>
            ))}
          </div>
        </div>

        {/* Lifting exercise cards */}
        {hasLifts && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">🏋️ Lifting — click any to drill in</p>
            <div className="grid grid-cols-2 gap-3">
              {liftingEntries.map(([exId, pts]) => {
                const exName = exercises.find(e => e.id === exId)?.name ?? exId;
                const values = pts.map(p => p.maxWeight).filter(v => v > 0);
                const best = values.length ? Math.max(...values) : 0;
                const first = values[0] ?? 0;
                const last = values[values.length - 1] ?? 0;
                const delta = last - first;
                return (
                  <button key={exId} onClick={() => { setSelectedExercise(exId); setView("lift"); }}
                    className="bg-[#1e1e1e] border border-[#2e2e2e] hover:border-[#444] rounded-2xl p-4 text-left transition-colors group">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors leading-tight">{exName}</p>
                      <span className={`text-xs font-medium ml-2 shrink-0 ${delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {first > 0 ? `${delta >= 0 ? "+" : ""}${delta} lbs` : "—"}
                      </span>
                    </div>
                    <Sparkline values={values} color="#3b82f6" isAmrap={false} />
                    <p className="text-xs text-gray-500 mt-2">Best: <span className="text-white">{best} lbs</span> · {pts.length} sessions</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* AMRAP cards */}
        {hasAmrap && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">AMRAP — reps over time</p>
            <div className="grid grid-cols-2 gap-3">
              {amrapEntries.map(([exId, pts]) => {
                const exName = exercises.find(e => e.id === exId)?.name ?? exId;
                const values = pts.map(p => p.maxReps).filter(v => v > 0);
                const best = values.length ? Math.max(...values) : 0;
                const first = values[0] ?? 0;
                const last = values[values.length - 1] ?? 0;
                const delta = last - first;
                return (
                  <button key={exId} onClick={() => { setSelectedExercise(exId); setView("lift"); }}
                    className="bg-[#1e1e1e] border border-[#2e2e2e] hover:border-[#444] rounded-2xl p-4 text-left transition-colors group">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-white group-hover:text-purple-400 transition-colors leading-tight">{exName}</p>
                      <span className={`text-xs font-medium ml-2 shrink-0 ${delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {first > 0 ? `${delta >= 0 ? "+" : ""}${delta} reps` : "—"}
                      </span>
                    </div>
                    <Sparkline values={values} color="#a78bfa" isAmrap={true} />
                    <p className="text-xs text-gray-500 mt-2">Best: <span className="text-white">{best} reps</span> · {pts.length} sessions</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Cardio sessions */}
        {WORKOUT_TYPES.filter(wt => wt.key !== "lifting").map(wt => {
          const cs = cardioSessions(wt.key);
          if (cs.length < 1) return null;
          const totalDist = cs.reduce((a, s) => a + (s.cardio_data?.distance_miles ?? 0), 0);
          const totalMin = cs.reduce((a, s) => a + (s.cardio_data?.duration_min ?? 0), 0);
          return (
            <button key={wt.key} onClick={() => { setCardioType(wt.key); setView("cardio"); }}
              className="w-full bg-[#1e1e1e] border border-[#2e2e2e] hover:border-[#444] rounded-2xl p-4 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{wt.emoji}</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">{wt.label}</p>
                  <p className="text-xs text-gray-500">
                    {cs.length} sessions
                    {totalDist > 0 && ` · ${totalDist.toFixed(1)} mi`}
                    {totalMin > 0 && ` · ${Math.round(totalMin / 60)}h total`}
                  </p>
                </div>
              </div>
              <span className="text-gray-500 text-sm">View trends →</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderLift = () => {
    const pts = selectedExercise ? history.get(selectedExercise) ?? [] : [];
    const exName = exercises.find(e => e.id === selectedExercise)?.name ?? "—";
    const isAmrap = pts.every(p => p.isAmrap);
    const values = isAmrap ? pts.map(p => p.maxReps) : pts.map(p => p.maxWeight);
    const maxVal = values.length ? Math.max(...values) : 1;
    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;
    const best1RM = isAmrap ? 0 : Math.max(...pts.map(p => p.best1RM));
    const H = 140;
    const W = 560;
    const unit = isAmrap ? "reps" : "lbs";
    const color = isAmrap ? "#a78bfa" : "#3b82f6";

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
          {isAmrap && <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">AMRAP</span>}
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: isAmrap ? "Best AMRAP" : "Best set", value: `${maxVal} ${unit}` },
            { label: "Est. 1RM", value: isAmrap ? "N/A" : `${best1RM} lbs` },
            { label: "Progress", value: first ? `+${last - first} ${unit}` : "—" },
            { label: "Sessions", value: String(pts.length) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-lg font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
            {exName} — {isAmrap ? "Max reps per session" : "Max weight per session"}
          </p>
          {pts.length < 2 ? (
            <p className="text-gray-600 text-sm">Need at least 2 sessions to show a trend.</p>
          ) : (
            <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full">
              {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                const y = H - pct * (H - 10);
                const val = Math.round(pct * maxVal);
                return (
                  <g key={pct}>
                    <line x1="30" y1={y} x2={W} y2={y} stroke="#2a2a2a" strokeWidth="1" />
                    <text x="0" y={y + 4} fill="#555" fontSize="9">{val}</text>
                  </g>
                );
              })}
              {(() => {
                const pointsStr = values.map((v, i) => {
                  const x = 30 + (i / (values.length - 1)) * (W - 30);
                  const y = H - (v / maxVal) * (H - 10);
                  return `${x},${y}`;
                }).join(" ");
                return (
                  <>
                    <polyline points={pointsStr} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {values.map((v, i) => {
                      const x = 30 + (i / (values.length - 1)) * (W - 30);
                      const y = H - (v / maxVal) * (H - 10);
                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r="4" fill={color} />
                          <text x={x} y={H + 20} fill="#555" fontSize="9" textAnchor="middle">
                            {new Date(pts[i].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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

        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Session History</p>
          <div className="space-y-2">
            {[...pts].reverse().map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0">
                <span className="text-sm text-gray-400">{formatDate(p.date)}</span>
                <div className="flex gap-4">
                  {isAmrap
                    ? <span className="text-xs text-gray-500">Max reps <span style={{ color }}>{p.maxReps}</span></span>
                    : <>
                      <span className="text-xs text-gray-500">Max <span className="text-white">{p.maxWeight} lbs</span></span>
                      <span className="text-xs text-gray-500">1RM <span className="text-blue-400">{p.best1RM} lbs</span></span>
                    </>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderCardio = () => {
    const cs = cardioSessions(cardioType).sort((a, b) => a.date.localeCompare(b.date));
    const t = typeInfo(cardioType);
    const hasDist = cs.some(s => s.cardio_data?.distance_miles);
    const hasDur = cs.some(s => s.cardio_data?.duration_min);
    const hasRounds = cs.some(s => s.cardio_data?.rounds);

    const renderMiniChart = (label: string, getValue: (s: Session) => number | undefined, unit: string, color: string) => {
      const pts = cs.map(s => ({ date: s.date, val: getValue(s) ?? 0 })).filter(p => p.val > 0);
      if (pts.length < 2) return null;
      const maxVal = Math.max(...pts.map(p => p.val));
      const H = 100;
      const W = 500;
      const pointsStr = pts.map((p, i) => {
        const x = (i / (pts.length - 1)) * W;
        const y = H - (p.val / maxVal) * (H - 10);
        return `${x},${y}`;
      }).join(" ");
      return (
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{label}</p>
          <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full">
            <polyline points={pointsStr} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => {
              const x = (i / (pts.length - 1)) * W;
              const y = H - (p.val / maxVal) * (H - 10);
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="4" fill={color} />
                  <text x={x} y={H + 15} fill="#555" fontSize="8" textAnchor="middle">
                    {new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="text-xs text-gray-500 mt-2">Best: <span className="text-white">{Math.max(...pts.map(p => p.val))} {unit}</span></p>
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-sm text-gray-500 hover:text-white transition-colors">← Overview</button>
          <div className="flex gap-2">
            {WORKOUT_TYPES.filter(wt => wt.key !== "lifting").map(wt => (
              <button
                key={wt.key}
                onClick={() => setCardioType(wt.key)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${cardioType === wt.key ? "text-black font-medium" : "text-gray-400 border border-[#333]"}`}
                style={cardioType === wt.key ? { backgroundColor: wt.color } : {}}
              >
                {wt.emoji} {wt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Sessions", value: String(cs.length) },
            { label: "Total time", value: cs.reduce((a, s) => a + (s.cardio_data?.duration_min ?? 0), 0) + " min" },
            { label: "Total distance", value: hasDist ? cs.reduce((a, s) => a + (s.cardio_data?.distance_miles ?? 0), 0).toFixed(1) + " mi" : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-lg font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {hasDur && renderMiniChart("Duration per session (min)", s => s.cardio_data?.duration_min, "min", t.color)}
        {hasDist && renderMiniChart("Distance per session (mi)", s => s.cardio_data?.distance_miles, "mi", t.color)}
        {hasRounds && renderMiniChart("Rounds per session", s => s.cardio_data?.rounds, "rounds", t.color)}
      </div>
    );
  };

  if (sessions.length === 0) return <p className="text-gray-600 text-sm">No workouts logged yet.</p>;

  return (
    <div>
      {view === "overview" && renderOverview()}
      {view === "lift" && renderLift()}
      {view === "cardio" && renderCardio()}
    </div>
  );
}
