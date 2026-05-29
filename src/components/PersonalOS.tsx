/**
 * PersonalOS.tsx — Personal productivity dashboard
 * Sections: Tasks/CRM, Habits, Goals, Finance, Calendar, Journal
 * Data stored in localStorage (ready for Supabase migration later)
 */

import { useState, useEffect } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

type Priority = "high" | "medium" | "low";
type TaskStatus = "todo" | "in_progress" | "done";

interface Task {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
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

interface FinanceItem {
  id: string;
  label: string;
  amount: number;
  type: "asset" | "expense";
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
  const [filter, setFilter] = useState<TaskStatus | "all">("all");

  useEffect(() => { LS.set("pos_tasks", tasks); }, [tasks]);

  const add = () => {
    if (!newTitle.trim()) return;
    setTasks(t => [...t, {
      id: uid(), title: newTitle.trim(), category: newCat,
      priority: newPriority, status: "todo", starred: false,
      createdAt: new Date().toISOString(),
    }]);
    setNewTitle("");
  };

  const toggle = (id: string, field: "starred") =>
    setTasks(t => t.map(x => x.id === id ? { ...x, [field]: !x[field] } : x));

  const setStatus = (id: string, status: TaskStatus) =>
    setTasks(t => t.map(x => x.id === id ? { ...x, status } : x));

  const remove = (id: string) => setTasks(t => t.filter(x => x.id !== id));

  const visible = filter === "all" ? tasks : tasks.filter(t => t.status === filter);
  const starred = tasks.filter(t => t.starred && t.status !== "done");

  return (
    <div className="space-y-6">
      {starred.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">⭐ Key Priorities</h3>
          <div className="space-y-2">
            {starred.map(t => (
              <div key={t.id} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <span className="flex-1 text-sm font-medium text-gray-800">{t.title}</span>
                <PriorityBadge p={t.priority} />
                <span className="text-xs text-gray-400">{t.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
          value={newPriority}
          onChange={e => setNewPriority(e.target.value as Priority)}
        >
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button
          onClick={add}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Add
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "todo", "in_progress", "done"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full border ${filter === f ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-400"}`}
          >
            {f === "all" ? "All" : f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {visible.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No tasks yet.</p>}
        {visible.map(t => (
          <div key={t.id} className={`flex items-center gap-3 border rounded-lg px-3 py-2 ${t.status === "done" ? "opacity-50 bg-gray-50" : "bg-white border-gray-200"}`}>
            <button onClick={() => toggle(t.id, "starred")} className="text-base">
              {t.starred ? "⭐" : "☆"}
            </button>
            <span className={`flex-1 text-sm ${t.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>
              {t.title}
            </span>
            <span className="text-xs text-gray-400">{t.category}</span>
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
            <button onClick={() => remove(t.id)} className="text-gray-300 hover:text-red-400 text-sm">✕</button>
          </div>
        ))}
      </div>
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

function FinanceSection() {
  const [items, setItems] = useState<FinanceItem[]>(() =>
    LS.get("pos_finance", [] as FinanceItem[])
  );
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"asset" | "expense">("asset");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => { LS.set("pos_finance", items); }, [items]);

  const add = () => {
    const n = parseFloat(amount);
    if (!label.trim() || isNaN(n)) return;
    setItems(i => [...i, { id: uid(), label: label.trim(), amount: n, type }]);
    setLabel(""); setAmount("");
  };

  const remove = (id: string) => setItems(i => i.filter(x => x.id !== id));

  const netWorth = items.filter(i => i.type === "asset").reduce((a, i) => a + i.amount, 0)
    - items.filter(i => i.type === "expense").reduce((a, i) => a + i.amount, 0);

  const fmt = (n: number) => revealed
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
    : "••••••";

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-1">
          <span className="text-blue-200 text-sm">Net Worth</span>
          <button
            onClick={() => setRevealed(r => !r)}
            className="text-xs bg-white/20 px-3 py-1 rounded-full hover:bg-white/30"
          >
            {revealed ? "Hide" : "Reveal"}
          </button>
        </div>
        <div className="text-3xl font-bold">{fmt(netWorth)}</div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <input className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Label (e.g. Savings)" value={label} onChange={e => setLabel(e.target.value)} />
        <input className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none" placeholder="Amount" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm" value={type} onChange={e => setType(e.target.value as "asset" | "expense")}>
          <option value="asset">Asset</option>
          <option value="expense">Expense</option>
        </select>
        <button onClick={add} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Add</button>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No items yet.</p>}
        {items.map(i => (
          <div key={i.id} className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${i.type === "asset" ? "bg-green-500" : "bg-red-400"}`} />
            <span className="flex-1 text-sm text-gray-800">{i.label}</span>
            <span className={`text-sm font-medium ${i.type === "asset" ? "text-green-600" : "text-red-500"}`}>
              {i.type === "expense" ? "-" : "+"}{fmt(i.amount)}
            </span>
            <button onClick={() => remove(i.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
          </div>
        ))}
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

type Section = "tasks" | "habits" | "goals" | "finance" | "calendar" | "journal";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "tasks", label: "Tasks", icon: "✅" },
  { id: "habits", label: "Habits", icon: "🔄" },
  { id: "goals", label: "Goals", icon: "🎯" },
  { id: "finance", label: "Finance", icon: "💰" },
  { id: "calendar", label: "Calendar", icon: "📅" },
  { id: "journal", label: "Journal", icon: "📓" },
];

export default function PersonalOS() {
  const [active, setActive] = useState<Section>("tasks");

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col py-6 px-4 gap-1 flex-shrink-0">
        <div className="mb-6 px-2">
          <div className="text-lg font-bold text-gray-900">My OS</div>
          <div className="text-xs text-gray-400 mt-0.5">{dateLabel}</div>
        </div>
        {SECTIONS.map(s => (
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {SECTIONS.find(s => s.id === active)?.icon}{" "}
          {SECTIONS.find(s => s.id === active)?.label}
        </h1>
        {active === "tasks" && <TasksSection />}
        {active === "habits" && <HabitsSection />}
        {active === "goals" && <GoalsSection />}
        {active === "finance" && <FinanceSection />}
        {active === "calendar" && <CalendarSection />}
        {active === "journal" && <JournalSection />}
      </main>
    </div>
  );
}
