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

// rollerblading / muaythai are no longer offered but old sessions still display.
type WorkoutType = "lifting" | "running" | "kettlebell" | "biking" | "yoga" | "lsit" | "rollerblading" | "muaythai";

interface CardioData {
  duration_min?: number;
  sets?: number;          // kettlebell: sets completed (with duration_min as total time); L-sit: sets done
  hold_sec?: number;      // L-sit: best hold in seconds
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
  lifting: "#2a78d6",
  running: "#eb6834",
  kettlebell: "#1baf7a",
  biking: "#eda100",
  yoga: "#e87ba4",
  lsit: "#008300",
  rollerblading: "#898781",
  muaythai: "#898781",
};

const WORKOUT_TYPES: { key: WorkoutType; label: string; emoji: string; color: string }[] = [
  { key: "lifting",    label: "Lifting",    emoji: "🏋️", color: "#2a78d6" },
  { key: "running",    label: "Running",    emoji: "🏃", color: "#eb6834" },
  { key: "kettlebell", label: "Kettlebell", emoji: "💪", color: "#1baf7a" },
  { key: "biking",     label: "Biking",     emoji: "🚴", color: "#eda100" },
  { key: "yoga",       label: "Yoga",       emoji: "🧘", color: "#e87ba4" },
  { key: "lsit",       label: "L-sit",      emoji: "🤸", color: "#008300" },
];
// Retired types, kept so older sessions still show their label.
const LEGACY_WORKOUT_TYPES: typeof WORKOUT_TYPES = [
  { key: "rollerblading", label: "Rollerblading", emoji: "🛼", color: "#898781" },
  { key: "muaythai",      label: "Muay Thai",     emoji: "🥊", color: "#898781" },
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
  return [...WORKOUT_TYPES, ...LEGACY_WORKOUT_TYPES].find(t => t.key === type) ?? WORKOUT_TYPES[0];
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
          <h2 className="text-2xl font-medium tracking-[-0.03em] text-[#111]">Workouts</h2>
          <p className="text-xs text-gray-500 mt-1">{sessions.length} sessions logged</p>
        </div>
        <div className="flex gap-2">
          {(["progress", "log", "history"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                tab === t ? "bg-[#111] text-[#F5F4F0]" : "text-gray-500 hover:text-[#111] border border-[#D9D7CF]"
              }`}
            >{t}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm animate-pulse">Loading…</p>
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
      <div className="bg-[#F5F4F0] border border-[#D9D7CF] rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Date</p>
            <input
              type="date"
              className="bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p>
            <input
              className="w-full bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] placeholder-gray-400 focus:outline-none"
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
                    : "text-gray-500 border-[#C9C7BF] hover:border-[#111] hover:text-[#111]"
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
        <div className="bg-[#F5F4F0] border border-[#D9D7CF] rounded-2xl p-5" style={{ borderColor: t.color + "44" }}>
          <p className="text-xs uppercase tracking-wider mb-4 text-gray-500">{t.emoji} {t.label} Details</p>
          <div className="grid grid-cols-2 gap-4">
            {workoutType === "lsit" && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Best hold (seconds)</p>
                <input
                  type="number"
                  step="any"
                  className="w-full bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none"
                  placeholder="10"
                  value={cardioData.hold_sec ?? ""}
                  onChange={e => setCardioData(p => ({ ...p, hold_sec: e.target.value ? parseFloat(e.target.value) : undefined }))}
                />
              </div>
            )}
            {(workoutType === "kettlebell" || workoutType === "lsit") && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Sets</p>
                <input
                  type="number"
                  className="w-full bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none"
                  placeholder="5"
                  value={cardioData.sets ?? ""}
                  onChange={e => setCardioData(p => ({ ...p, sets: e.target.value ? parseInt(e.target.value) : undefined }))}
                />
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">{workoutType === "kettlebell" ? "Total time (min)" : "Duration (min)"}</p>
              <input
                type="number"
                className="w-full bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none"
                placeholder={workoutType === "kettlebell" ? "35" : "45"}
                step="any"
                value={cardioData.duration_min ?? ""}
                onChange={e => setCardioData(p => ({ ...p, duration_min: e.target.value ? parseFloat(e.target.value) : undefined }))}
              />
            </div>
            {(workoutType === "running" || workoutType === "biking") && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Distance (miles)</p>
                <input
                  type="number"
                  step="0.1"
                  className="w-full bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none"
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
                  className="w-full bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none"
                  placeholder="9:30"
                  value={cardioData.avg_pace ?? ""}
                  onChange={e => setCardioData(p => ({ ...p, avg_pace: e.target.value || undefined }))}
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
          <div key={de.exercise_id + exIdx} className="bg-[#F5F4F0] border border-[#D9D7CF] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[#111] font-medium">{de.exercise_name}</h3>
              <button onClick={() => removeExercise(exIdx)} className="text-xs text-gray-500 hover:text-red-600 transition-colors">Remove</button>
            </div>

            {/* Set headers */}
            <div className="grid grid-cols-[40px_1fr_1fr_80px_32px] gap-2 mb-2">
              <span className="text-xs text-gray-500">Set</span>
              <span className="text-xs text-gray-500">Weight (lbs)</span>
              <span className="text-xs text-gray-500">Reps</span>
              <span className="text-xs text-gray-500 text-center">AMRAP</span>
              <span />
            </div>

            {de.sets.map((s, setIdx) => {
              const prevSet = prev[setIdx];
              return (
                <div key={s.id} className="grid grid-cols-[40px_1fr_1fr_80px_32px] gap-2 mb-2 items-center">
                  <span className="text-xs text-gray-500">{setIdx + 1}</span>
                  <input
                    type="number"
                    className={`bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none w-full transition-opacity ${s.is_amrap ? "opacity-30 pointer-events-none" : ""}`}
                    placeholder={prevSet?.weight_lbs ? String(prevSet.weight_lbs) : "0"}
                    value={s.weight_lbs}
                    onChange={e => updateSet(exIdx, setIdx, "weight_lbs", e.target.value)}
                    disabled={s.is_amrap}
                  />
                  <input
                    type="number"
                    className="bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none w-full"
                    placeholder={prevSet?.reps ? String(prevSet.reps) : "0"}
                    value={s.reps}
                    onChange={e => updateSet(exIdx, setIdx, "reps", e.target.value)}
                  />
                  <div className="flex justify-center">
                    <button
                      onClick={() => toggleAmrap(exIdx, setIdx)}
                      className={`w-9 h-5 rounded-full transition-colors relative ${s.is_amrap ? "bg-purple-500" : "bg-[#E6E4DE]"}`}
                      title="AMRAP — track max reps, no weight"
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${s.is_amrap ? "left-4" : "left-0.5"}`} />
                    </button>
                  </div>
                  <button onClick={() => removeSet(exIdx, setIdx)} className="text-gray-500 hover:text-red-600 text-lg leading-none transition-colors">×</button>
                </div>
              );
            })}

            <button onClick={() => addSet(exIdx)} className="text-xs text-gray-500 hover:text-[#111] border border-[#C9C7BF] rounded-lg px-3 py-1.5 mt-1 transition-colors">
              + Add Set
            </button>
          </div>
        );
      })}

      {/* Exercise search (lifting only) */}
      {isLifting && (
        <div className="bg-[#F5F4F0] border border-[#D9D7CF] rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Add Exercise</p>
          <div className="relative">
            <input
              ref={searchRef}
              className="w-full bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] placeholder-gray-400 focus:outline-none"
              placeholder="Search exercises or type new…"
              value={search}
              onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
            />
            {showDropdown && search.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-[#C9C7BF] rounded-xl overflow-hidden shadow-xl">
                {filtered.map(ex => (
                  <button
                    key={ex.id}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-[#E6E4DE] transition-colors"
                    onMouseDown={() => addExercise(ex)}
                  >
                    {ex.name}
                    <span className="text-xs text-gray-500 ml-2">{ex.category}</span>
                  </button>
                ))}
                {!filtered.find(e => e.name.toLowerCase() === search.toLowerCase()) && (
                  <button
                    className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-[#E6E4DE] border-t border-[#C9C7BF] transition-colors"
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
                  className="text-xs text-gray-500 hover:text-[#111] border border-[#D9D7CF] hover:border-[#111] rounded-lg px-3 py-1.5 transition-colors"
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
      <p className="text-gray-500 text-sm mb-4">No workouts logged yet.</p>
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
          <div key={s.id} className="bg-[#F5F4F0] border border-[#D9D7CF] rounded-2xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#E6E4DE] transition-colors"
              onClick={() => { setExpanded(isOpen ? null : s.id); if (isEditing) setEditing(null); }}
            >
              <div className="text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[#111] font-medium text-sm">{formatDate(s.date)}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: t.color + "26", color: "#111" }}>
                    {t.emoji} {t.label}
                  </span>
                  {s.notes && (
                    <span className="text-xs text-gray-500 italic">{s.notes}</span>
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
                <span className="text-gray-500">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {isOpen && !isEditing && (
              <div className="px-5 pb-5 border-t border-[#D9D7CF]">
                {s.notes && <p className="text-xs text-gray-500 mt-3 mb-4 italic">{s.notes}</p>}

                {!isLifting && s.cardio_data && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {cardioFields(s.type, s.cardio_data).map(({ label, value }) => (
                      <div key={label} className="bg-white rounded-xl p-3">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-sm font-medium text-[#111] mt-0.5">{value}</p>
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
                        <p className="text-sm font-medium text-[#111]">{name}</p>
                        <div className="flex gap-3">
                          {maxW > 0 && <span className="text-xs text-gray-500">Max <span className="text-[#111]">{maxW} lbs</span></span>}
                          {best1rm > 0 && <span className="text-xs text-gray-500">1RM est. <span className="text-blue-600">{best1rm} lbs</span></span>}
                          {hasAmrap && <span className="text-xs text-gray-500">AMRAP best <span className="text-purple-600">{maxReps} reps</span></span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-[40px_1fr_1fr_60px] gap-2">
                        <span className="text-xs text-gray-500">Set</span>
                        <span className="text-xs text-gray-500">Weight</span>
                        <span className="text-xs text-gray-500">Reps</span>
                        <span className="text-xs text-gray-500">Type</span>
                        {exSets.map((st, i) => (
                          <>
                            <span key={st.id + "n"} className="text-xs text-gray-500">{i + 1}</span>
                            <span key={st.id + "w"} className="text-xs text-[#111]">{st.is_amrap ? "—" : `${st.weight_lbs ?? "—"} lbs`}</span>
                            <span key={st.id + "r"} className="text-xs text-[#111]">{st.reps ?? "—"} reps</span>
                            <span key={st.id + "t"} className="text-xs" style={{ color: st.is_amrap ? "#4a3aa7" : "#898781" }}>{st.is_amrap ? "AMRAP" : "Weighted"}</span>
                          </>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="flex gap-4 mt-5">
                  <button onClick={() => startEdit(s)} className="text-xs text-gray-500 hover:text-[#111] border border-[#C9C7BF] rounded-lg px-3 py-1.5 transition-colors">Edit workout</button>
                  <button onClick={async () => { await db.sessions.delete(s.id); onDelete(s.id); }} className="text-xs text-gray-500 hover:text-red-600 transition-colors">Delete</button>
                </div>
              </div>
            )}

            {isOpen && isEditing && (
              <div className="px-5 pb-5 border-t border-[#D9D7CF] space-y-4 pt-4">
                <div className="flex gap-3">
                  <input type="date" className="bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] focus:outline-none" value={editDate} onChange={e => setEditDate(e.target.value)} />
                  <input className="flex-1 bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] placeholder-gray-400 focus:outline-none" placeholder="Notes…" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                </div>

                {isLifting && editExercises.map((de, exIdx) => (
                  <div key={de.exercise_id + exIdx} className="bg-white border border-[#C9C7BF] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-[#111]">{de.exercise_name}</p>
                      <button onClick={() => removeEditExercise(exIdx)} className="text-xs text-gray-500 hover:text-red-600 transition-colors">Remove</button>
                    </div>
                    <div className="grid grid-cols-[32px_1fr_1fr_60px_28px] gap-2 mb-1">
                      <span className="text-xs text-gray-500">Set</span>
                      <span className="text-xs text-gray-500">Weight</span>
                      <span className="text-xs text-gray-500">Reps</span>
                      <span className="text-xs text-gray-500 text-center">AMRAP</span>
                      <span />
                    </div>
                    {de.sets.map((s, setIdx) => (
                      <div key={s.id} className="grid grid-cols-[32px_1fr_1fr_60px_28px] gap-2 mb-2 items-center">
                        <span className="text-xs text-gray-500">{setIdx + 1}</span>
                        <input type="number" className={`bg-[#F5F4F0] border border-[#C9C7BF] rounded-lg px-2 py-1.5 text-sm text-[#111] focus:outline-none w-full ${s.is_amrap ? "opacity-30" : ""}`} value={s.weight_lbs} onChange={e => updateEditSet(exIdx, setIdx, "weight_lbs", e.target.value)} placeholder="lbs" disabled={s.is_amrap} />
                        <input type="number" className="bg-[#F5F4F0] border border-[#C9C7BF] rounded-lg px-2 py-1.5 text-sm text-[#111] focus:outline-none w-full" value={s.reps} onChange={e => updateEditSet(exIdx, setIdx, "reps", e.target.value)} placeholder="reps" />
                        <div className="flex justify-center">
                          <button
                            onClick={() => toggleEditAmrap(exIdx, setIdx)}
                            className={`w-9 h-5 rounded-full transition-colors relative ${s.is_amrap ? "bg-purple-500" : "bg-[#E6E4DE]"}`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${s.is_amrap ? "left-4" : "left-0.5"}`} />
                          </button>
                        </div>
                        <button onClick={() => removeEditSet(exIdx, setIdx)} className="text-gray-500 hover:text-red-600 text-lg leading-none transition-colors">×</button>
                      </div>
                    ))}
                    <button onClick={() => addEditSet(exIdx)} className="text-xs text-gray-500 hover:text-[#111] border border-[#C9C7BF] rounded-lg px-3 py-1 mt-1 transition-colors">+ Set</button>
                  </div>
                ))}

                {isLifting && (
                  <div className="relative">
                    <input
                      className="w-full bg-white border border-[#C9C7BF] rounded-lg px-3 py-2 text-sm text-[#111] placeholder-gray-400 focus:outline-none"
                      placeholder="Add exercise…"
                      value={exSearch}
                      onChange={e => { setExSearch(e.target.value); setShowExDropdown(true); }}
                      onFocus={() => setShowExDropdown(true)}
                    />
                    {showExDropdown && exSearch.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-[#C9C7BF] rounded-xl overflow-hidden shadow-xl">
                        {filteredEx.map(ex => (
                          <button key={ex.id} className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-[#E6E4DE] transition-colors" onMouseDown={() => addEditExercise(ex)}>
                            {ex.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button onClick={() => saveEdit(s)} disabled={saving} className="bg-[#111] text-[#F5F4F0] px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#333] disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Save changes"}</button>
                  <button onClick={() => setEditing(null)} className="text-sm text-gray-500 hover:text-[#111] transition-colors">Cancel</button>
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
  if (data.hold_sec) parts.push(`${data.hold_sec}s hold`);
  if (data.sets) parts.push(`${data.sets} sets`);
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
  if (data.hold_sec) fields.push({ label: "Best hold", value: `${data.hold_sec} s` });
  if (data.sets) fields.push({ label: "Sets", value: String(data.sets) });
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
  type HistoryPoint = { date: string; maxWeight: number; best1RM: number; maxReps: number; isAmrap: boolean; sets: WorkoutSet[] };

  const exerciseHistory = () => {
    const map = new Map<string, HistoryPoint[]>();
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
          sets,
        });
      });
    }
    return map;
  };

  const history = exerciseHistory();

  // Mini sparkline SVG for a card
  const Sparkline = ({ values, color, isAmrap }: { values: number[]; color: string; isAmrap: boolean }) => {
    if (values.length < 2) return <div className="h-10 flex items-end"><span className="text-xs text-gray-500">Not enough data</span></div>;
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
          return <circle key={i} cx={x} cy={y} r="4" fill={color} stroke="#F5F4F0" strokeWidth="2" />;
        })}
      </svg>
    );
  };

  const renderOverview = () => {
    const liftingEntries = [...history.entries()].filter(([, pts]) => pts.some(p => p.maxWeight > 0));
    const amrapEntries = [...history.entries()].filter(([, pts]) => pts.every(p => p.isAmrap) && pts.some(p => p.maxReps > 0));
    const hasLifts = liftingEntries.length > 0;
    const hasAmrap = amrapEntries.length > 0;

    if (!hasLifts && !hasAmrap && WORKOUT_TYPES.every(wt => wt.key === "lifting" || cardioSessions(wt.key).length < 1)) {
      return <p className="text-gray-500 text-sm">No workout data yet.</p>;
    }

    return (
      <div className="space-y-5">
        {/* Monthly calendar — full width, 10 cols */}
        <div className="bg-[#F5F4F0] border border-[#D9D7CF] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { const d = new Date(calYear, calMonth - 1, 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }} className="text-gray-500 hover:text-[#111] w-6 h-6 flex items-center justify-center transition-colors">‹</button>
            <p className="text-sm font-medium text-[#111]">{calLabel} <span className="text-gray-500 font-normal text-xs">· {monthSessions.length} sessions</span></p>
            <button onClick={() => { const d = new Date(calYear, calMonth + 1, 1); if (d <= now) { setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); } }} className={`w-6 h-6 flex items-center justify-center transition-colors ${new Date(calYear, calMonth + 1, 1) > now ? "text-gray-600 cursor-default" : "text-gray-500 hover:text-[#111]"}`}>›</button>
          </div>
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
              const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const types = workoutDateMap[ds] ?? [];
              const isToday = ds === todayStr();
              return (
                <div key={d} className={`rounded-lg p-1.5 flex flex-col items-center gap-1 ${isToday ? "bg-[#E6E4DE]" : types.length > 0 ? "bg-white" : ""}`}>
                  <span className={`text-xs leading-none ${isToday ? "font-bold text-[#111]" : types.length > 0 ? "text-gray-600" : "text-gray-500"}`}>{d}</span>
                  {types.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap justify-center">
                      {types.map(t => (
                        <span key={t} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: WORKOUT_COLORS[t] ?? "#ef4444" }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
            {WORKOUT_TYPES.map(wt => (
              <span key={wt.key} className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: wt.color }} />
                {wt.label}
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
                const rawValues = pts.map(p => p.best1RM).filter(v => v > 0);
                const smoothed = rawValues.map((_, i) => {
                  const window = rawValues.slice(Math.max(0, i - 1), i + 2);
                  return Math.round(window.reduce((a, b) => a + b, 0) / window.length);
                });
                const values = smoothed;
                const best = rawValues.length ? Math.max(...rawValues) : 0;
                const first = rawValues[0] ?? 0;
                const delta = best - first;
                return (
                  <button key={exId} onClick={() => { setSelectedExercise(exId); setView("lift"); }}
                    className="bg-[#F5F4F0] border border-[#D9D7CF] hover:border-[#111] rounded-2xl p-4 text-left transition-colors group">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-[#111] group-hover:text-blue-600 transition-colors leading-tight">{exName}</p>
                      <span className={`text-xs font-medium ml-2 shrink-0 ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {first > 0 ? `${delta >= 0 ? "+" : ""}${delta} lbs` : "—"}
                      </span>
                    </div>
                    <Sparkline values={values} color="#111111" isAmrap={false} />
                    <p className="text-xs text-gray-500 mt-2">Est. 1RM: <span className="text-[#111]">{best} lbs</span> · {pts.length} sessions</p>
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
                    className="bg-[#F5F4F0] border border-[#D9D7CF] hover:border-[#111] rounded-2xl p-4 text-left transition-colors group">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-[#111] group-hover:text-purple-600 transition-colors leading-tight">{exName}</p>
                      <span className={`text-xs font-medium ml-2 shrink-0 ${delta >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {first > 0 ? `${delta >= 0 ? "+" : ""}${delta} reps` : "—"}
                      </span>
                    </div>
                    <Sparkline values={values} color="#4a3aa7" isAmrap={true} />
                    <p className="text-xs text-gray-500 mt-2">Best: <span className="text-[#111]">{best} reps</span> · {pts.length} sessions</p>
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
              className="w-full bg-[#F5F4F0] border border-[#D9D7CF] hover:border-[#111] rounded-2xl p-4 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{wt.emoji}</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-[#111]">{wt.label}</p>
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

  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const renderLift = () => {
    const pts = selectedExercise ? history.get(selectedExercise) ?? [] : [];
    const exName = exercises.find(e => e.id === selectedExercise)?.name ?? "—";
    const isAmrap = pts.every(p => p.isAmrap);
    const rawValues = isAmrap ? pts.map(p => p.maxReps) : pts.map(p => p.best1RM);
    const values = rawValues.map((_, i) => {
      const window = rawValues.slice(Math.max(0, i - 1), i + 2);
      return Math.round(window.reduce((a, b) => a + b, 0) / window.length);
    });
    const maxVal = values.length ? Math.max(...values) : 1;
    const first = rawValues[0] ?? 0;
    const best1RM = isAmrap ? 0 : Math.max(...pts.map(p => p.best1RM));
    const H = 140;
    const W = 560;
    const unit = isAmrap ? "reps" : "lbs";
    const color = isAmrap ? "#4a3aa7" : "#111111";

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-sm text-gray-500 hover:text-[#111] transition-colors">← Overview</button>
          <select
            className="bg-white border border-[#C9C7BF] rounded-lg px-3 py-1.5 text-sm text-[#111] focus:outline-none"
            value={selectedExercise ?? ""}
            onChange={e => setSelectedExercise(e.target.value)}
          >
            {[...history.keys()].map(exId => (
              <option key={exId} value={exId}>{exercises.find(e => e.id === exId)?.name ?? exId}</option>
            ))}
          </select>
          {isAmrap && <span className="text-xs text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-full">AMRAP</span>}
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: isAmrap ? "Best AMRAP" : "Est. 1RM", value: `${maxVal} ${unit}` },
            { label: "All-time best", value: isAmrap ? "N/A" : `${best1RM} lbs` },
            { label: "Progress", value: first ? `+${best1RM - first} ${unit}` : "—" },
            { label: "Sessions", value: String(pts.length) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#F5F4F0] border border-[#D9D7CF] rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-lg font-bold text-[#111]">{value}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#F5F4F0] border border-[#D9D7CF] rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
            {exName} — {isAmrap ? "Max reps per session" : "Est. 1RM per session"}
          </p>
          {pts.length < 2 ? (
            <p className="text-gray-500 text-sm">Need at least 2 sessions to show a trend.</p>
          ) : (
            <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full">
              {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                const y = H - pct * (H - 10);
                const val = Math.round(pct * maxVal);
                return (
                  <g key={pct}>
                    <line x1="30" y1={y} x2={W} y2={y} stroke="#D9D7CF" strokeWidth="1" />
                    <text x="0" y={y + 4} fill="#5f5e5a" fontSize="9">{val}</text>
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
                    <polyline points={pointsStr} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {values.map((v, i) => {
                      const x = 30 + (i / (values.length - 1)) * (W - 30);
                      const y = H - (v / maxVal) * (H - 10);
                      return (
                        <g key={i}>
                          <circle cx={x} cy={y} r="4" fill={color} stroke="#F5F4F0" strokeWidth="2" />
                          <text x={x} y={H + 20} fill="#5f5e5a" fontSize="9" textAnchor="middle">
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

        <div className="bg-[#F5F4F0] border border-[#D9D7CF] rounded-2xl overflow-hidden">
          <p className="text-xs text-gray-500 uppercase tracking-wider p-5 pb-3">Session History</p>
          <div>
            {[...pts].reverse().map((p, i) => {
              const key = p.date + i;
              const isOpen = expandedSession === key;
              return (
                <div key={key} className="border-t border-[#D9D7CF]">
                  <button
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-[#E6E4DE] transition-colors text-left"
                    onClick={() => setExpandedSession(isOpen ? null : key)}
                  >
                    <span className="text-sm text-gray-600">{formatDate(p.date)}</span>
                    <div className="flex items-center gap-4">
                      {isAmrap
                        ? <span className="text-xs text-gray-500">Max reps <span style={{ color }}>{p.maxReps}</span></span>
                        : <>
                          <span className="text-xs text-gray-500">Est. 1RM <span className="text-blue-600">{p.best1RM} lbs</span></span>
                          <span className="text-xs text-gray-500">Max <span className="text-[#111]">{p.maxWeight} lbs</span></span>
                        </>
                      }
                      <span className="text-gray-500 text-xs">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 bg-[#F5F4F0]">
                      <div className="grid grid-cols-[2rem_1fr_1fr_4rem] gap-x-3 gap-y-1 mt-1">
                        <span className="text-xs text-gray-500">Set</span>
                        <span className="text-xs text-gray-500">Weight</span>
                        <span className="text-xs text-gray-500">Reps</span>
                        <span className="text-xs text-gray-500">Type</span>
                        {p.sets.sort((a, b) => a.set_number - b.set_number).map((st, si) => (
                          <>
                            <span key={st.id + "n"} className="text-xs text-gray-500">{si + 1}</span>
                            <span key={st.id + "w"} className="text-xs text-[#111]">{st.is_amrap ? "—" : `${st.weight_lbs ?? "—"} lbs`}</span>
                            <span key={st.id + "r"} className="text-xs text-[#111]">{st.reps ?? "—"}</span>
                            <span key={st.id + "t"} className="text-xs" style={{ color: st.is_amrap ? "#4a3aa7" : "#898781" }}>{st.is_amrap ? "AMRAP" : ""}</span>
                          </>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
    const hasSets = cs.some(s => s.cardio_data?.sets);
    const hasHold = cs.some(s => s.cardio_data?.hold_sec);

    const renderMiniChart = (label: string, getValue: (s: Session) => number | undefined, unit: string, color: string) => {
      const pts = cs.map(s => ({ date: s.date, val: getValue(s) ?? 0 })).filter(p => p.val > 0);
      if (pts.length < 2) return null;
      const maxVal = Math.max(...pts.map(p => p.val));
      const H = 110;
      const W = 900;
      const PX = 32;
      const xOf = (i: number) => PX + (i / (pts.length - 1)) * (W - 2 * PX);
      const yOf = (v: number) => H - (v / maxVal) * (H - 14);
      const pointsStr = pts.map((p, i) => `${xOf(i)},${yOf(p.val)}`).join(" ");
      return (
        <div className="bg-[#F5F4F0] border border-[#D9D7CF] rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{label}</p>
          <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full">
            <line x1={PX} y1={H} x2={W - PX} y2={H} stroke="#D9D7CF" strokeWidth="1" />
            <polyline points={pointsStr} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => {
              const x = xOf(i);
              const y = yOf(p.val);
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="4" fill={color} stroke="#F5F4F0" strokeWidth="2" />
                  <text x={x} y={H + 18} fill="#5f5e5a" fontSize="12" textAnchor="middle">
                    {new Date(p.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="text-xs text-gray-500 mt-2">Best: <span className="text-[#111]">{Math.max(...pts.map(p => p.val))} {unit}</span></p>
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-sm text-gray-500 hover:text-[#111] transition-colors">← Overview</button>
          <div className="flex gap-2">
            {WORKOUT_TYPES.filter(wt => wt.key !== "lifting").map(wt => (
              <button
                key={wt.key}
                onClick={() => setCardioType(wt.key)}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${cardioType === wt.key ? "text-black font-medium" : "text-gray-500 border border-[#C9C7BF]"}`}
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
            <div key={label} className="bg-[#F5F4F0] border border-[#D9D7CF] rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-lg font-bold text-[#111]">{value}</p>
            </div>
          ))}
        </div>

        {hasHold && renderMiniChart("Best hold per session (s)", s => s.cardio_data?.hold_sec, "s", t.color)}
        {hasSets && renderMiniChart("Sets per session", s => s.cardio_data?.sets, "sets", t.color)}
        {hasDur && renderMiniChart(cardioType === "kettlebell" ? "Total time per session (min)" : "Duration per session (min)", s => s.cardio_data?.duration_min, "min", t.color)}
        {hasDist && renderMiniChart("Distance per session (mi)", s => s.cardio_data?.distance_miles, "mi", t.color)}
        {hasRounds && renderMiniChart("Rounds per session", s => s.cardio_data?.rounds, "rounds", t.color)}
      </div>
    );
  };

  if (sessions.length === 0) return <p className="text-gray-500 text-sm">No workouts logged yet.</p>;

  return (
    <div>
      {view === "overview" && renderOverview()}
      {view === "lift" && renderLift()}
      {view === "cardio" && renderCardio()}
    </div>
  );
}
