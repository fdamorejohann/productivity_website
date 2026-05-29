/**
 * WeekDashboard.tsx — "today's agenda" view.
 *
 * Shows:
 *   - Weekly score summary at the top (overall % + progress bar)
 *   - All PlannedTasks scheduled for today, as a completion checklist
 *   - Toggling a task here calls the same togglePlanComplete handler used
 *     by the Planner, so both views stay in sync automatically
 *   - Empty state with a nudge to the Planner if nothing is scheduled today
 */

import type { Goal, CompletionLog, PlannedTask } from "../lib/types";
import { goalUnitLabel } from "../lib/types";
import { getWeekScore } from "../lib/scoring";
import { currentWeekKeys, formatShortDate, today, getDayName } from "../lib/date";

interface Props {
  goals: Goal[];
  logs: CompletionLog[];
  plans: PlannedTask[];
  weekStart: Date;
  onToggleComplete: (planId: string) => void;
}

export default function WeekDashboard({ goals, logs, plans, weekStart, onToggleComplete }: Props) {
  const weekKeys = currentWeekKeys(weekStart);
  const weekScore = getWeekScore(goals, logs, weekStart);
  const weekLabel = `${formatShortDate(weekKeys[0])} – ${formatShortDate(weekKeys[6])}`;
  const todayStr = today();
  const goalMap = new Map(goals.map((g) => [g.id, g]));

  const scoreColor =
    weekScore >= 80 ? "#22c55e" : weekScore >= 50 ? "#f97316" : "#ef4444";

  // Plans for today only, with their goal resolved — incomplete first
  const todayPlans = plans
    .filter((p) => p.date === todayStr && goalMap.has(p.goalId))
    .sort((a, b) => Number(a.completed) - Number(b.completed));

  const completedCount = todayPlans.filter((p) => p.completed).length;

  return (
    <div className="p-8 max-w-3xl mx-auto">

      {/* ── Week score header ── */}
      <div className="mb-8">
        <p className="text-sm text-gray-400 font-medium uppercase tracking-wide mb-1">
          Week of {weekLabel}
        </p>
        <div className="flex items-end gap-4">
          <h1 className="text-3xl font-bold text-gray-900">This Week</h1>
          <div className="mb-1 flex items-baseline gap-1">
            <span className="text-3xl font-bold" style={{ color: scoreColor }}>
              {weekScore}%
            </span>
            <span className="text-sm text-gray-400">overall</span>
          </div>
        </div>
        <div className="mt-3 bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${weekScore}%`, backgroundColor: scoreColor }}
          />
        </div>
      </div>

      {/* ── Today's task list ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Today &mdash; {getDayName(todayStr, false)}
          </h2>
          {todayPlans.length > 0 && (
            <span className="text-sm text-gray-400">
              {completedCount} / {todayPlans.length} done
            </span>
          )}
        </div>

        {todayPlans.length === 0 ? (
          <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-2xl">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium text-gray-500">Nothing scheduled for today</p>
            <p className="text-sm text-gray-400 mt-1">
              Open the <strong>Planner</strong> to assign goals to days this week
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayPlans.map((plan) => {
              const goal = goalMap.get(plan.goalId)!;
              return (
                <TodayTask
                  key={plan.id}
                  plan={plan}
                  goal={goal}
                  onToggle={onToggleComplete}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TodayTask ────────────────────────────────────────────────────────────────

function TodayTask({
  plan,
  goal,
  onToggle,
}: {
  plan: PlannedTask;
  goal: Goal;
  onToggle: (planId: string) => void;
}) {
  const amountLabel =
    goal.trackingMode === "cumulative"
      ? `${Number.isInteger(plan.amount) ? plan.amount : +plan.amount.toFixed(2)} ${goalUnitLabel(goal)}`
      : null;

  return (
    <div
      onClick={() => onToggle(plan.id)}
      className="flex items-center gap-4 px-4 py-3.5 rounded-xl border cursor-pointer transition-all hover:shadow-sm select-none"
      style={{
        backgroundColor: plan.completed ? goal.color + "0d" : "white",
        borderColor: plan.completed ? goal.color + "40" : "#e5e7eb",
        borderLeftWidth: "4px",
        borderLeftColor: goal.color,
      }}
    >
      {/* Completion circle */}
      <div
        className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all"
        style={{
          backgroundColor: plan.completed ? goal.color : "transparent",
          border: `2px solid ${plan.completed ? goal.color : "#d1d5db"}`,
        }}
      >
        {plan.completed && "✓"}
      </div>

      {/* Goal name + amount */}
      <div className="flex-1 min-w-0">
        <span
          className={`font-medium text-sm ${
            plan.completed ? "line-through opacity-50" : "text-gray-800"
          }`}
        >
          {goal.name}
        </span>
        {amountLabel && (
          <span className="ml-2 text-xs text-gray-400">{amountLabel}</span>
        )}
      </div>

      {/* Status label */}
      <span
        className="text-xs font-medium flex-shrink-0"
        style={{ color: plan.completed ? goal.color : "#9ca3af" }}
      >
        {plan.completed ? "Done" : "Mark done"}
      </span>
    </div>
  );
}
