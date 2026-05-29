/**
 * PersonalOS.tsx — Personal productivity dashboard
 * Sections: Tasks/CRM, Habits, Goals, Finance, Calendar, Journal
 * Data stored in localStorage (ready for Supabase migration later)
 */

import { useState, useEffect, useCallback } from "react";
import BudgetPanel from "./BudgetPanel";
import budgetData from "../data/budget.json";

// ─── Types ─────────────────────────────────────────────────────────────────

type Priority = "high" | "medium" | "low";
type TaskStatus = "todo" | "in_progress" | "done";
type TaskSize = "important" | "small";

interface Task {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  size: TaskSize;
  starred: boolean;
  createdAt: string;
}

interface Habit {
  id: string;
  name: string;
  subtasks: { id: string; label: string; done: boolean }[];
}

interface DailyHabits {
  date: string; // YYYY-MM-DD
  completedSubtasks: string[]; // subtask IDs
}

interface Goal {
  id: string;
  title: string;
  period: "week" | "month";
  done: boolean;
}

interface JournalEntry {
  id: string;
  date: string;
  text: string;
}


// ─── Storage helpers ────────────────────────────────────────────────────────

const LS = {
  get: <T,>(key: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set: <T,>(key: string, value: T) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => crypto.randomUUID();

// ─── Default data ───────────────────────────────────────────────────────────

const DEFAULT_HABITS: Habit[] = [
  {
    id: "h1",
    name: "Morning Workout",
    subtasks: [
      { id: "h1s1", label: "Warm up", done: false },
      { id: "h1s2", label: "Main session", done: false },
      { id: "h1s3", label: "Cool down", done: false },
    ],
  },
  {
    id: "h2",
    name: "Supplements",
    subtasks: [
      { id: "h2s1", label: "Morning pills", done: false },
      { id: "h2s2", label: "Evening pills", done: false },
    ],
  },
  {
    id: "h3",
    name: "Creative Session",
    subtasks: [
      { id: "h3s1", label: "Read / research", done: false },
      { id: "h3s2", label: "Ideate / write", done: false },
    ],
  },
  {
    id: "h4",
    name: "Evening Wind-down",
    subtasks: [
      { id: "h4s1", label: "Review day", done: false },
      { id: "h4s2", label: "Journal entry", done: false },
      { id: "h4s3", label: "Plan tomorrow", done: false },
    ],
  },
];

// ─── Sub-components ─────────────────────────────────────────────────────────

function PriorityBadge({ p }: { p: Priority }) {
  const styles: Record<Priority, string> = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-green-100 text-green-700",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[p]}`}>
      {p}
    </span>
  );
}

// ─── Sections ───────────────────────────────────────────────────────────────

function TasksSection() {
  const [tasks, setTasks] = useState<Task[]>(() =>
    LS.get("pos_tasks", [] as Task[])
  );
  const [newTitle, setNewTitle] = useState("");
  const [newCat, setNewCat] = useState("General");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newSize, setNewSize] = useState<TaskSize>("important");

  useEffect(() => { LS.set("pos_tasks", tasks); }, [tasks]);

  const add = () => {
    if (!newTitle.trim()) return;
    setTasks(t => [...t, {
      id: uid(), title: newTitle.trim(), category: newCat,
      priority: newPriority, status: "todo", size: newSize,
      starred: false, createdAt: new Date().toISOString(),
    }]);
    setNewTitle("");
  };

  const toggleStar = (id: string) =>
    setTasks(t => t.map(x => x.id === id ? { ...x, starred: !x.starred } : x));

  const setStatus = (id: string, status: TaskStatus) =>
    setTasks(t => t.map(x => x.id === id ? { ...x, status } : x));

  const remove = (id: string) => setTasks(t => t.filter(x => x.id !== id));

  const important = tasks.filter(t => t.size === "important");
  const small = tasks.filter(t => t.size === "small");

  const TaskRow = ({ t }: { t: Task }) => (
    <div className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 ${t.status === "done" ? "opacity-40 bg-gray-50" : "bg-white border-gray-200"}`}>
      <button onClick={() => toggleStar(t.id)} className="text-base flex-shrink-0" title="Star to show on home page">
        {t.starred ? "⭐" : "☆"}
      </button>
      <span className={`flex-1 text-sm ${t.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>
        {t.title}
      </span>
      <span className="text-xs text-gray-400 hidden sm:block">{t.category}</span>
      <PriorityBadge p={t.priority} />
      <select
        className="text-xs border border-gray-200 rounded px-1 py-0.5"
        value={t.status}
        onChange={e => setStatus(t.id, e.target.value as TaskStatus)}
      >
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
      </select>
      <button onClick={() => remove(t.id)} className="text-gray-300 hover:text-red-400 text-sm flex-shrink-0">✕</button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Add task */}
      <div className="flex gap-2 flex-wrap">
        <input
          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="New task…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
        />
        <input
          className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          placeholder="Category"
          value={newCat}
          onChange={e => setNewCat(e.target.value)}
        />
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={newSize}
          onChange={e => setNewSize(e.target.value as TaskSize)}
        >
          <option value="important">Important</option>
          <option value="small">Small</option>
        </select>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={newPriority}
          onChange={e => setNewPriority(e.target.value as Priority)}
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Add
        </button>
      </div>

      {/* Two lanes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Important */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🎯</span>
            <h3 className="font-semibold text-gray-800">Important</h3>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{important.length}</span>
          </div>
          <div className="space-y-2">
            {important.length === 0 && <p className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">No important tasks</p>}
            {important.map(t => <TaskRow key={t.id} t={t} />)}
          </div>
        </div>

        {/* Small */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">⚡</span>
            <h3 className="font-semibold text-gray-800">Small Tasks</h3>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{small.length}</span>
          </div>
          <div className="space-y-2">
            {small.length === 0 && <p className="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">No small tasks</p>}
            {small.map(t => <TaskRow key={t.id} t={t} />)}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">⭐ Star any task to pin it to the home page as a key priority.</p>
    </div>
  );
}

function HabitsSection() {
  const [habits] = useState<Habit[]>(() =>
    LS.get("pos_habits", DEFAULT_HABITS)
  );
  const [daily, setDaily] = useState<DailyHabits>(() =>
    LS.get(`pos_daily_${todayStr()}`, { date: todayStr(), completedSubtasks: [] })
  );

  useEffect(() => { LS.set("pos_habits", habits); }, [habits]);
  useEffect(() => { LS.set(`pos_daily_${todayStr()}`, daily); }, [daily]);

  const toggleSubtask = (subtaskId: string) => {
    setDaily(d => ({
      ...d,
      completedSubtasks: d.completedSubtasks.includes(subtaskId)
        ? d.completedSubtasks.filter(id => id !== subtaskId)
        : [...d.completedSubtasks, subtaskId],
    }));
  };

  const totalSubtasks = habits.reduce((acc, h) => acc + h.subtasks.length, 0);
  const completedCount = daily.completedSubtasks.length;
  const pct = totalSubtasks === 0 ? 0 : Math.round((completedCount / totalSubtasks) * 100);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-100 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-gray-700">{pct}% today</span>
      </div>

      <div className="space-y-3">
        {habits.map(h => {
          const habitDone = h.subtasks.every(s => daily.completedSubtasks.includes(s.id));
          return (
            <div key={h.id} className={`border rounded-xl p-4 ${habitDone ? "border-green-300 bg-green-50" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center text-xs ${habitDone ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                  {habitDone ? "✓" : ""}
                </span>
                <span className="font-medium text-sm text-gray-800">{h.name}</span>
              </div>
              <div className="space-y-1 pl-6">
                {h.subtasks.map(s => {
                  const done = daily.completedSubtasks.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggleSubtask(s.id)}
                        className="rounded"
                      />
                      <span className={`text-sm ${done ? "line-through text-gray-400" : "text-gray-600"}`}>
                        {s.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalsSection() {
  const [goals, setGoals] = useState<Goal[]>(() =>
    LS.get("pos_goals", [] as Goal[])
  );
  const [newTitle, setNewTitle] = useState("");
  const [period, setPeriod] = useState<"week" | "month">("month");

  useEffect(() => { LS.set("pos_goals", goals); }, [goals]);

  const add = () => {
    if (!newTitle.trim()) return;
    setGoals(g => [...g, { id: uid(), title: newTitle.trim(), period, done: false }]);
    setNewTitle("");
  };

  const toggle = (id: string) =>
    setGoals(g => g.map(x => x.id === id ? { ...x, done: !x.done } : x));

  const remove = (id: string) => setGoals(g => g.filter(x => x.id !== id));

  const weekly = goals.filter(g => g.period === "week");
  const monthly = goals.filter(g => g.period === "month");

  const GoalGroup = ({ title, items }: { title: string; items: Goal[] }) => (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h3>
      {items.length === 0 && <p className="text-sm text-gray-400">None set.</p>}
      <div className="space-y-2">
        {items.map(g => (
          <div key={g.id} className="flex items-center gap-3">
            <button onClick={() => toggle(g.id)} className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs flex-shrink-0 ${g.done ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300"}`}>
              {g.done ? "✓" : ""}
            </button>
            <span className={`flex-1 text-sm ${g.done ? "line-through text-gray-400" : "text-gray-800"}`}>{g.title}</span>
            <button onClick={() => remove(g.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="New goal…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
        />
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
          value={period}
          onChange={e => setPeriod(e.target.value as "week" | "month")}
        >
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Add</button>
      </div>
      <GoalGroup title="This week" items={weekly} />
      <GoalGroup title="This month" items={monthly} />
    </div>
  );
}

function FinanceSection({ onOpenBudget }: { onOpenBudget: () => void }) {
  const [revealed, setRevealed] = useState(false);

  const {
    month,
    rawFreeSpend,
    freeSpendRemaining,
    variableActualSpent,
    savingsTarget,
    savingsActual,
    variableExpenses,
  } = budgetData;

  const freeSpendPct = Math.max(0, Math.min(100, (freeSpendRemaining / rawFreeSpend) * 100));
  const savingsPct = savingsTarget > 0 ? Math.min(100, (savingsActual / savingsTarget) * 100) : 0;
  const isOverBudget = freeSpendRemaining < 0;

  const fmt = (n: number) =>
    revealed ? `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0 })}` : "••••";

  return (
    <div className="space-y-6">
      {/* Main finance card — click to open full budget */}
      <button
        onClick={onOpenBudget}
        className="w-full text-left bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white hover:from-slate-700 hover:to-slate-800 transition-all group"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wider">Free to Spend · {month}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-3xl font-bold ${isOverBudget ? "text-red-400" : "text-white"}`}>
                {isOverBudget ? "-" : ""}{fmt(freeSpendRemaining)}
              </span>
              <span className="text-slate-400 text-sm">/ {fmt(rawFreeSpend)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); setRevealed(r => !r); }}
              className="text-xs bg-white/10 px-3 py-1 rounded-full hover:bg-white/20"
            >
              {revealed ? "Hide" : "Reveal"}
            </button>
            <span className="text-slate-400 group-hover:text-white text-sm">→</span>
          </div>
        </div>

        {/* Descending free-spend bar */}
        <div className="mb-1">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isOverBudget ? "bg-red-400" : freeSpendPct < 20 ? "bg-orange-400" : "bg-emerald-400"}`}
              style={{ width: `${freeSpendPct}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {revealed ? `$${variableActualSpent.toLocaleString()} spent` : "•••"} of {fmt(rawFreeSpend)} budget
          </p>
        </div>
      </button>

      {/* Ascending savings bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider">Savings · {month}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-gray-900">{fmt(savingsActual)}</span>
              <span className="text-gray-400 text-sm">/ {fmt(savingsTarget)}</span>
            </div>
          </div>
          <span className="text-2xl">📈</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${savingsPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{Math.round(savingsPct)}% of monthly savings goal</p>
      </div>

      {/* Variable expense breakdown */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Variable Spending</h3>
        <div className="space-y-2">
          {variableExpenses.map((row) => {
            const pct = row.budget > 0 ? Math.min(100, (row.actual / row.budget) * 100) : 0;
            const over = row.actual > row.budget && row.budget > 0;
            return (
              <div key={row.label}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-gray-600">{row.label}</span>
                  <span className={over ? "text-red-500 font-medium" : "text-gray-500"}>
                    {revealed ? `$${row.actual} / $${row.budget}` : "•••"}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${over ? "bg-red-400" : "bg-blue-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 mt-3">Run <code className="bg-gray-100 px-1 rounded">python3 scripts/extract-budget.py</code> to sync latest data.</p>
      </div>
    </div>
  );
}

function CalendarSection() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const weekDates = days.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const [events, setEvents] = useState<{ id: string; date: string; title: string; time: string }[]>(() =>
    LS.get("pos_events", [])
  );
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(todayStr());
  const [newTime, setNewTime] = useState("09:00");

  useEffect(() => { LS.set("pos_events", events); }, [events]);

  const add = () => {
    if (!newTitle.trim()) return;
    setEvents(e => [...e, { id: uid(), date: newDate, title: newTitle.trim(), time: newTime }]);
    setNewTitle("");
  };

  const remove = (id: string) => setEvents(e => e.filter(x => x.id !== id));

  return (
    <div className="space-y-6">
      {/* Week grid */}
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((d, i) => {
          const dateStr = d.toISOString().slice(0, 10);
          const isToday = dateStr === todayStr();
          const dayEvents = events.filter(e => e.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
          return (
            <div key={i} className={`rounded-xl p-2 min-h-24 ${isToday ? "bg-blue-50 border-2 border-blue-400" : "bg-gray-50 border border-gray-200"}`}>
              <div className={`text-xs font-semibold mb-1 ${isToday ? "text-blue-600" : "text-gray-500"}`}>
                {days[i]}
              </div>
              <div className={`text-lg font-bold mb-2 ${isToday ? "text-blue-700" : "text-gray-700"}`}>
                {d.getDate()}
              </div>
              <div className="space-y-1">
                {dayEvents.map(ev => (
                  <div key={ev.id} className="group relative bg-blue-600 text-white text-xs rounded px-1.5 py-0.5 truncate">
                    {ev.time} {ev.title}
                    <button onClick={() => remove(ev.id)} className="absolute right-0.5 top-0.5 hidden group-hover:block text-white/70 hover:text-white">✕</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add event */}
      <div className="flex gap-2 flex-wrap">
        <input className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Event title…" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
        <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={newDate} onChange={e => setNewDate(e.target.value)} />
        <input type="time" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={newTime} onChange={e => setNewTime(e.target.value)} />
        <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Add</button>
      </div>
    </div>
  );
}

function JournalSection() {
  const [entries, setEntries] = useState<JournalEntry[]>(() =>
    LS.get("pos_journal", [] as JournalEntry[])
  );
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { LS.set("pos_journal", entries); }, [entries]);

  const save = () => {
    if (!text.trim()) return;
    setEntries(e => [{ id: uid(), date: todayStr(), text: text.trim() }, ...e]);
    setText("");
  };

  return (
    <div className="space-y-4">
      <div>
        <textarea
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          rows={5}
          placeholder="What happened today? How are you feeling? What went well, what didn't?"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button onClick={save} className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Save Entry
        </button>
      </div>

      <div className="space-y-3">
        {entries.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No entries yet.</p>}
        {entries.map(e => (
          <div key={e.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
              onClick={() => setExpanded(expanded === e.id ? null : e.id)}
            >
              <span className="text-sm font-medium text-gray-700">{e.date}</span>
              <span className="text-xs text-gray-400 max-w-xs truncate">{e.text.slice(0, 60)}…</span>
              <span className="text-gray-400 text-sm ml-2">{expanded === e.id ? "▲" : "▼"}</span>
            </button>
            {expanded === e.id && (
              <div className="px-4 pb-4 text-sm text-gray-700 whitespace-pre-wrap border-t border-gray-100 pt-3">
                {e.text}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

type Section = "tasks" | "habits" | "goals" | "finance" | "calendar" | "journal" | "budget";

const SECTIONS: { id: Section; label: string; icon: string; hidden?: boolean }[] = [
  { id: "tasks", label: "Tasks", icon: "✅" },
  { id: "habits", label: "Habits", icon: "🔄" },
  { id: "goals", label: "Goals", icon: "🎯" },
  { id: "finance", label: "Finance", icon: "💰" },
  { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "journal", label: "Journal", icon: "📓" },
  { id: "budget", label: "Budget", icon: "📊", hidden: true },
];

export default function PersonalOS() {
  const [active, setActive] = useState<Section>("tasks");

  const openBudget = useCallback(() => setActive("budget"), []);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const visibleSections = SECTIONS.filter(s => !s.hidden);
  const current = SECTIONS.find(s => s.id === active)!;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col py-6 px-4 gap-1 flex-shrink-0">
        <div className="mb-6 px-2">
          <div className="text-lg font-bold text-gray-900">My OS</div>
          <div className="text-xs text-gray-400 mt-0.5">{dateLabel}</div>
        </div>
        {visibleSections.map(s => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active === s.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            <span>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 overflow-y-auto">
        {active === "budget" ? (
          <div>
            <button onClick={() => setActive("finance")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4">
              ← Back to Finance
            </button>
            <BudgetPanel />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
              {current.icon} {current.label}
            </h1>
            {active === "tasks" && <TasksSection />}
            {active === "habits" && <HabitsSection />}
            {active === "goals" && <GoalsSection />}
            {active === "finance" && <FinanceSection onOpenBudget={openBudget} />}
            {active === "calendar" && <CalendarSection />}
            {active === "journal" && <JournalSection />}
          </>
        )}
      </main>
    </div>
  );
}
