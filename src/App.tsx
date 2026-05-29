/**
 * App.tsx — root component and single source of truth for all app state.
 *
 * Architecture:
 *   All state (goals, plans, logs) lives here. Child components receive data
 *   and callback props — they never read from or write to storage directly.
 *   This makes the data flow predictable: user action → callback → state update
 *   → useEffect saves to localStorage → React re-renders children.
 *
 * State:
 *   goals   — the user's defined goals (persisted)
 *   plans   — planned tasks on the week grid (persisted)
 *   logs    — completion log entries that drive scoring (persisted)
 *   view    — which panel is currently visible (not persisted)
 *   weekStart — Monday of the current week (derived once, stable for the session)
 */

import { useState, useCallback, useEffect } from "react";
import type { Goal, PlannedTask, CompletionLog, View } from "./lib/types";
import { storage } from "./lib/storage";
import { startOfWeek, today } from "./lib/date";
import Sidebar from "./components/Sidebar";
import WeekDashboard from "./components/WeekDashboard";
import WeekPlanner from "./components/WeekPlanner";
import AnalyticsPanel from "./components/AnalyticsPanel";
import BudgetPanel from "./components/BudgetPanel";

export default function App() {
  // Initialise state from localStorage on first render only (lazy initialisers)
  const [goals, setGoals] = useState<Goal[]>(() => storage.getGoals());
  const [plans, setPlans] = useState<PlannedTask[]>(() => storage.getPlannedTasks());
  const [logs, setLogs] = useState<CompletionLog[]>(() => storage.getCompletionLogs());
  const [view, setView] = useState<View>("dashboard");

  // Computed once — week doesn't change mid-session
  const weekStart = startOfWeek(new Date());

  // ─── Persistence effects ───────────────────────────────────────────────────
  // Each piece of state has its own effect so only the relevant key is written
  // when that slice changes. Runs after every render where the value changed.
  useEffect(() => { storage.saveGoals(goals); }, [goals]);
  useEffect(() => { storage.savePlannedTasks(plans); }, [plans]);
  useEffect(() => { storage.saveCompletionLogs(logs); }, [logs]);

  // ─── Auto-complete past planned tasks ────────────────────────────────────
  // On mount: find any planned tasks whose date is before today and not yet
  // marked done. Silently mark them complete and create a CompletionLog for each.
  // Intent: "you planned it, the day passed — assume you did it."
  // Runs once on mount using the plans loaded from localStorage at startup.
  useEffect(() => {
    const todayStr = today();
    const stale = plans.filter((p) => p.date < todayStr && !p.completed);
    if (stale.length === 0) return;

    // Pre-generate a logId for each stale plan so we can link them
    const pairs = stale.map((plan) => ({ plan, logId: crypto.randomUUID() }));

    setLogs((prev) => [
      ...prev,
      // Use plan.amount so cumulative chunks (e.g. 20 min) score correctly
      ...pairs.map(({ plan, logId }) => ({
        id: logId,
        goalId: plan.goalId,
        date: plan.date,
        value: plan.amount,
      })),
    ]);
    setPlans((prev) =>
      prev.map((p) => {
        const pair = pairs.find((x) => x.plan.id === p.id);
        return pair ? { ...p, completed: true, logId: pair.logId } : p;
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — only run on mount

  // ─── Goal actions ─────────────────────────────────────────────────────────

  const addGoal = useCallback((goal: Goal) => {
    setGoals((prev) => [...prev, goal]);
  }, []);

  const updateGoal = useCallback((id: string, updates: Partial<Goal>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  }, []);

  /**
   * Deletes a goal and cascades: removes all its plans and ALL completion logs
   * (both planner-created logs via logId, and dashboard-created logs via goalId).
   */
  const deleteGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setPlans((prev) => {
      const removing = prev.filter((p) => p.goalId === id);
      const logIdsToRemove = new Set(removing.map((p) => p.logId).filter(Boolean));
      setLogs((l) => l.filter((log) => !logIdsToRemove.has(log.id) && log.goalId !== id));
      return prev.filter((p) => p.goalId !== id);
    });
  }, []);

  // ─── Logging (dashboard) ──────────────────────────────────────────────────

  /**
   * Creates a CompletionLog for today.
   * Called from GoalCard's "+ Log 1" / cumulative log input.
   * value defaults to 1; cumulative goals pass a decimal (e.g. 0.5 hours).
   */
  // ─── Plan actions (planner) ───────────────────────────────────────────────

  /**
   * Adds a PlannedTask for `goalId` on `date`.
   * If the date is in the past, immediately marks it complete and creates a log
   * (retroactive planning = assume you did it).
   */
  /**
   * amount = 1 for frequency goals; the chosen chunk size for cumulative goals
   * (e.g. 20 for "20 minutes"). Past-date plans are immediately auto-completed.
   */
  const addPlan = useCallback((goalId: string, date: string, amount = 1) => {
    const todayStr = today();
    const isPast = date < todayStr;
    const planId = crypto.randomUUID();
    const logId = isPast ? crypto.randomUUID() : undefined;

    if (isPast && logId) {
      setLogs((prev) => [...prev, { id: logId, goalId, date, value: amount }]);
    }

    setPlans((prev) => [
      ...prev,
      { id: planId, goalId, date, amount, completed: isPast, logId, createdAt: new Date().toISOString() },
    ]);
  }, []);

  /**
   * Removes a PlannedTask. If it was completed, also removes its linked CompletionLog
   * so the score isn't inflated by deleted plans.
   */
  const removePlan = useCallback((id: string) => {
    setPlans((prev) => {
      const plan = prev.find((p) => p.id === id);
      if (plan?.logId) {
        setLogs((l) => l.filter((log) => log.id !== plan.logId));
      }
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  /**
   * Toggles a PlannedTask between completed / not-completed.
   *
   * Marking done:   creates a CompletionLog (value=1) and stores its ID on the plan.
   * Marking undone: removes that specific CompletionLog via plan.logId.
   *
   * Using logId as the link means only the planner-created log is removed —
   * any separate dashboard logs for the same goal+date are untouched.
   */
  const togglePlanComplete = useCallback(
    (planId: string) => {
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return;

      if (!plan.completed) {
        const logId = crypto.randomUUID();
        // Use plan.amount so cumulative chunks score correctly
        setLogs((prev) => [
          ...prev,
          { id: logId, goalId: plan.goalId, date: plan.date, value: plan.amount },
        ]);
        setPlans((prev) =>
          prev.map((p) => (p.id === planId ? { ...p, completed: true, logId } : p))
        );
      } else {
        if (plan.logId) {
          setLogs((prev) => prev.filter((l) => l.id !== plan.logId));
        }
        setPlans((prev) =>
          prev.map((p) =>
            p.id === planId ? { ...p, completed: false, logId: undefined } : p
          )
        );
      }
    },
    [plans] // needs current plans to find the plan by ID
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-white text-gray-900 overflow-hidden">
      {/* Sidebar: always visible, controls view and goal management */}
      <Sidebar
        goals={goals}
        view={view}
        onViewChange={setView}
        onAddGoal={addGoal}
        onDeleteGoal={deleteGoal}
        onToggleActive={updateGoal}
      />

      {/* Main content: swaps between the three views */}
      <main className="flex-1 overflow-auto">
        {view === "dashboard" && (
          <WeekDashboard
            goals={goals}
            logs={logs}
            plans={plans}
            weekStart={weekStart}
            onToggleComplete={togglePlanComplete}
          />
        )}
        {view === "planner" && (
          <WeekPlanner
            goals={goals}
            plans={plans}
            weekStart={weekStart}
            onAddPlan={addPlan}
            onRemovePlan={removePlan}
            onToggleComplete={togglePlanComplete}
          />
        )}
        {view === "analytics" && <AnalyticsPanel />}
        {view === "budget" && <BudgetPanel />}
      </main>
    </div>
  );
}
