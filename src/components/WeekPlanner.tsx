/**
 * WeekPlanner.tsx — Monday–Sunday planning grid.
 *
 * Click-to-assign interaction:
 *   1. Click a goal chip in the palette → it becomes "selected"
 *   2. Day columns highlight to show they're clickable
 *   3. Click a day column:
 *        Frequency goal → placed immediately (if under weekly limit)
 *        Cumulative goal → opens CumulativeAmountPicker modal to choose a chunk size
 *   4. Click selected goal again or press Escape to deselect
 *
 * Frequency cap:
 *   Each frequency goal tracks how many instances are placed in the current week.
 *   Once count >= goal.target the chip is disabled and shows "3/3 ✓".
 *   When the last slot is filled the selection auto-clears.
 *
 * Cumulative amount picker:
 *   When a cumulative goal is assigned to a day, the user chooses how big the chunk is.
 *   Preset buttons are generated from the goal's unit and remaining unassigned amount.
 *   The chosen amount is stored on PlannedTask.amount and flows to CompletionLog.value
 *   when the task is toggled complete.
 *
 * PlanChip:
 *   Extracted as its own component for per-chip hover state.
 *   Shows goal name + amount (for cumulative) + completion toggle + hover-reveal remove.
 */

import { useState, useEffect } from "react";
import type { Goal, PlannedTask } from "../lib/types";
import { goalUnitLabel } from "../lib/types";
import { currentWeekKeys, getDayName, formatShortDate, today, toDateString } from "../lib/date";

interface Props {
  goals: Goal[];
  plans: PlannedTask[];
  weekStart: Date;
  onAddPlan: (goalId: string, date: string, amount?: number) => void;
  onRemovePlan: (id: string) => void;
  onToggleComplete: (planId: string) => void;
}

export default function WeekPlanner({
  goals,
  plans,
  weekStart,
  onAddPlan,
  onRemovePlan,
  onToggleComplete,
}: Props) {
  // Local navigation state — starts on the current week, can browse freely
  const [viewWeekStart, setViewWeekStart] = useState<Date>(() => new Date(weekStart));

  const viewWeekKeys = currentWeekKeys(viewWeekStart);
  const viewWeekKeySet = new Set(viewWeekKeys);
  const activeGoals = goals.filter((g) => g.active);
  const todayStr = today();
  const goalMap = new Map(goals.map((g) => [g.id, g]));

  // Is the viewed week the actual current week?
  const isCurrentWeek = toDateString(viewWeekStart) === toDateString(weekStart);

  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  // When non-null, the cumulative amount picker is open for this date
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  function goPrev() {
    setViewWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
    setSelectedGoalId(null);
    setPickerDate(null);
  }

  function goNext() {
    setViewWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
    setSelectedGoalId(null);
    setPickerDate(null);
  }

  function goToCurrentWeek() {
    setViewWeekStart(new Date(weekStart));
    setSelectedGoalId(null);
    setPickerDate(null);
  }

  // ─── Per-goal week stats ───────────────────────────────────────────────────
  // Computed from the VIEWED week's plans so caps are per-week.
  const plannedCountThisWeek = new Map<string, number>(); // frequency: # of instances placed
  const plannedAmountThisWeek = new Map<string, number>(); // cumulative: total amount assigned

  for (const plan of plans) {
    if (!viewWeekKeySet.has(plan.date)) continue;
    plannedCountThisWeek.set(plan.goalId, (plannedCountThisWeek.get(plan.goalId) ?? 0) + 1);
    plannedAmountThisWeek.set(plan.goalId, (plannedAmountThisWeek.get(plan.goalId) ?? 0) + plan.amount);
  }

  // Deselect on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setSelectedGoalId(null); setPickerDate(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleGoalClick(goalId: string) {
    const goal = goalMap.get(goalId);
    if (!goal) return;
    // Prevent selecting a frequency goal that's already at its limit
    if (goal.trackingMode === "frequency") {
      const count = plannedCountThisWeek.get(goalId) ?? 0;
      if (count >= goal.target) return;
    }
    setSelectedGoalId((prev) => (prev === goalId ? null : goalId));
  }

  function handleDayClick(date: string) {
    if (!selectedGoalId) return;
    const goal = goalMap.get(selectedGoalId);
    if (!goal) return;

    if (goal.trackingMode === "frequency") {
      // Double-check limit hasn't been reached between selection and click
      const count = plannedCountThisWeek.get(selectedGoalId) ?? 0;
      if (count >= goal.target) { setSelectedGoalId(null); return; }

      onAddPlan(selectedGoalId, date, 1);

      // Auto-deselect when the last slot is filled
      if (count + 1 >= goal.target) setSelectedGoalId(null);
    } else {
      // Cumulative: open the amount picker for this day
      setPickerDate(date);
    }
  }

  function handlePickerConfirm(amount: number) {
    if (!selectedGoalId || !pickerDate) return;
    onAddPlan(selectedGoalId, pickerDate, amount);
    setPickerDate(null);

    // Auto-deselect if the goal is now fully assigned
    const goal = goalMap.get(selectedGoalId);
    if (goal) {
      const alreadyAssigned = (plannedAmountThisWeek.get(selectedGoalId) ?? 0) + amount;
      if (alreadyAssigned >= goal.target) setSelectedGoalId(null);
    }
  }

  function handleChipClick(e: React.MouseEvent, planId: string) {
    e.stopPropagation();
    onToggleComplete(planId);
  }

  function handleRemoveClick(e: React.MouseEvent, planId: string) {
    e.stopPropagation();
    onRemovePlan(planId);
  }

  const selectedGoal = selectedGoalId ? goalMap.get(selectedGoalId) : null;

  return (
    <div className="p-8 overflow-x-auto">

      {/* ── Header ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl font-bold text-gray-900">Weekly Planner</h1>

          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goPrev}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Previous week"
            >
              &#8592;
            </button>
            <div className="text-center min-w-40">
              <div className="text-sm font-medium text-gray-700">
                {formatShortDate(viewWeekKeys[0])} &ndash; {formatShortDate(viewWeekKeys[6])}
              </div>
              {isCurrentWeek ? (
                <div className="text-xs text-blue-500 font-medium">Current Week</div>
              ) : (
                <button
                  onClick={goToCurrentWeek}
                  className="text-xs text-gray-400 hover:text-blue-500 underline underline-offset-2 transition-colors"
                >
                  Go to current week
                </button>
              )}
            </div>
            <button
              onClick={goNext}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Next week"
            >
              &#8594;
            </button>
          </div>
        </div>

        {selectedGoal ? (
          <div className="mt-2 flex items-center gap-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ backgroundColor: selectedGoal.color + "20", color: selectedGoal.color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedGoal.color }} />
              Adding: {selectedGoal.name}
            </div>
            <span className="text-sm text-gray-400">
              {selectedGoal.trackingMode === "cumulative"
                ? "Click a day — you'll choose the amount"
                : "Click a day to place it"}
            </span>
            <button
              onClick={() => setSelectedGoalId(null)}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100"
            >
              Cancel (Esc)
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-400 mt-1">
            Select a goal below, then click a day to plan it. Click a chip to mark it done.
          </p>
        )}
      </div>

      {/* ── Day columns ── */}
      <div className="flex gap-3 min-w-max">
        {viewWeekKeys.map((dateStr) => {
          const dayPlans = plans.filter((p) => p.date === dateStr);
          const isToday = dateStr === todayStr;
          const isPast = dateStr < todayStr;
          const isClickable = !!selectedGoalId;

          return (
            <div key={dateStr} className="flex flex-col" style={{ width: 150 }}>
              <div
                className={`rounded-xl px-3 py-2 mb-2 text-center ${
                  isToday ? "bg-blue-500 text-white"
                  : isPast ? "bg-gray-100 text-gray-400"
                  : "bg-gray-100 text-gray-600"
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-wide">{getDayName(dateStr)}</div>
                <div className={`text-sm font-bold ${isToday ? "text-white" : isPast ? "text-gray-400" : "text-gray-800"}`}>
                  {formatShortDate(dateStr)}
                </div>
              </div>

              <div
                onClick={() => handleDayClick(dateStr)}
                className={`flex-1 min-h-44 rounded-xl border-2 p-2 flex flex-col gap-1.5 transition-all ${
                  isClickable
                    ? "border-blue-300 bg-blue-50/60 cursor-pointer hover:bg-blue-100/60"
                    : "border-dashed border-gray-200 bg-gray-50"
                }`}
              >
                {dayPlans.map((plan) => {
                  const goal = goalMap.get(plan.goalId);
                  if (!goal) return null;
                  return (
                    <PlanChip
                      key={plan.id}
                      plan={plan}
                      goal={goal}
                      onToggle={handleChipClick}
                      onRemove={handleRemoveClick}
                    />
                  );
                })}
                {isClickable && (
                  <div className="flex-1 flex items-center justify-center min-h-6">
                    <span className="text-xs text-blue-400 font-medium opacity-70">+ place here</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Goal palette ── */}
      <div className="mt-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          {selectedGoalId ? "Goals — click to change selection" : "Goals — click to select"}
        </p>
        {activeGoals.length === 0 ? (
          <p className="text-sm text-gray-400">No active goals. Add one in the sidebar.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeGoals.map((goal) => {
              const isSelected = selectedGoalId === goal.id;
              const isFrequency = goal.trackingMode === "frequency";

              const count = plannedCountThisWeek.get(goal.id) ?? 0;
              const assignedAmount = plannedAmountThisWeek.get(goal.id) ?? 0;

              const atLimit = isFrequency
                ? count >= goal.target
                : assignedAmount >= goal.target;

              // Badge text shown on the right of the chip
              const badge = isFrequency
                ? `${count}/${goal.target}`
                : assignedAmount > 0
                  ? `${formatAmount(assignedAmount, goal)} / ${formatAmount(goal.target, goal)}`
                  : null;

              return (
                <button
                  key={goal.id}
                  onClick={() => handleGoalClick(goal.id)}
                  disabled={atLimit}
                  className={`flex flex-col px-3 py-2 rounded-xl border-2 text-left transition-all ${
                    atLimit
                      ? "opacity-50 cursor-not-allowed"
                      : isSelected
                      ? "shadow-md scale-105 cursor-pointer"
                      : "hover:shadow-md cursor-pointer"
                  }`}
                  style={{
                    backgroundColor: isSelected ? goal.color + "20" : goal.color + "0d",
                    borderColor: isSelected ? goal.color : atLimit ? goal.color + "40" : goal.color + "40",
                    color: goal.color,
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isSelected ? "ring-2 ring-offset-1" : ""}`}
                      style={{ backgroundColor: goal.color, "--tw-ring-color": goal.color } as React.CSSProperties}
                    />
                    {goal.name}
                    {isSelected && <span className="text-xs opacity-60 ml-1">selected</span>}
                    {/* Count / amount badge */}
                    {badge && (
                      <span
                        className={`ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full ${
                          atLimit ? "text-white" : "opacity-70"
                        }`}
                        style={{ backgroundColor: atLimit ? goal.color : goal.color + "25" }}
                      >
                        {atLimit ? "✓ full" : badge}
                      </span>
                    )}
                  </div>
                  {goal.description && (
                    <span className="text-xs mt-0.5 pl-4 opacity-60 max-w-48 truncate">
                      {goal.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Cumulative amount picker modal ── */}
      {selectedGoal && pickerDate && selectedGoal.trackingMode === "cumulative" && (
        <CumulativeAmountPicker
          goal={selectedGoal}
          date={pickerDate}
          alreadyAssigned={plannedAmountThisWeek.get(selectedGoal.id) ?? 0}
          onConfirm={handlePickerConfirm}
          onCancel={() => setPickerDate(null)}
        />
      )}
    </div>
  );
}

// ─── PlanChip ─────────────────────────────────────────────────────────────────

function PlanChip({
  plan,
  goal,
  onToggle,
  onRemove,
}: {
  plan: PlannedTask;
  goal: Goal;
  onToggle: (e: React.MouseEvent, id: string) => void;
  onRemove: (e: React.MouseEvent, id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  // Show the assigned amount for cumulative goals (e.g. "20 min", "0.5 hrs")
  const amountLabel =
    goal.trackingMode === "cumulative" && plan.amount !== 1
      ? formatAmount(plan.amount, goal)
      : null;

  return (
    <div
      onClick={(e) => onToggle(e, plan.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all select-none"
      style={{
        backgroundColor: plan.completed ? goal.color + "28" : "white",
        border: `1px solid ${goal.color}${plan.completed ? "60" : "30"}`,
        borderLeftWidth: "3px",
        borderLeftColor: goal.color,
      }}
      title={plan.completed ? "Click to mark incomplete" : "Click to mark complete"}
    >
      {/* Completion circle */}
      <span
        className="flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-xs font-bold"
        style={{
          backgroundColor: plan.completed ? goal.color : "transparent",
          border: `2px solid ${plan.completed ? goal.color : goal.color + "60"}`,
        }}
      >
        {plan.completed && "✓"}
      </span>

      <span
        className={`flex-1 text-xs font-medium truncate ${plan.completed ? "opacity-70" : "opacity-90"}`}
        style={{ color: goal.color }}
      >
        {goal.name}
      </span>

      {/* Amount label for cumulative chunks */}
      {amountLabel && (
        <span
          className="text-xs flex-shrink-0 opacity-60 ml-0.5"
          style={{ color: goal.color }}
        >
          {amountLabel}
        </span>
      )}

      {hovered && (
        <button
          onClick={(e) => onRemove(e, plan.id)}
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full text-gray-400 hover:text-red-400 hover:bg-red-50 transition-colors text-xs leading-none"
          title="Remove plan"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── CumulativeAmountPicker ───────────────────────────────────────────────────

/**
 * Modal that lets the user choose how much of a cumulative goal to assign to a day.
 * Shows preset buttons based on unit and remaining unassigned amount, plus a free input.
 */
function CumulativeAmountPicker({
  goal,
  date,
  alreadyAssigned,
  onConfirm,
  onCancel,
}: {
  goal: Goal;
  date: string;
  alreadyAssigned: number;
  onConfirm: (amount: number) => void;
  onCancel: () => void;
}) {
  const remaining = Math.max(0, goal.target - alreadyAssigned);
  const presets = getPresets(goal, remaining > 0 ? remaining : goal.target);
  const [customValue, setCustomValue] = useState(
    // Default custom input to the first preset value
    presets.length > 0 ? String(presets[0].value) : ""
  );
  const [selectedPreset, setSelectedPreset] = useState<number | null>(
    presets.length > 0 ? presets[0].value : null
  );

  const confirmAmount = selectedPreset ?? parseFloat(customValue);
  const canConfirm = !isNaN(confirmAmount) && confirmAmount > 0;

  function handlePresetClick(value: number) {
    setSelectedPreset(value);
    setCustomValue(String(value));
  }

  function handleCustomChange(raw: string) {
    setCustomValue(raw);
    setSelectedPreset(null);
  }

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!canConfirm) return;
    onConfirm(confirmAmount);
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5">

        {/* Header */}
        <p className="text-xs font-medium text-gray-400 mb-1">
          Add to {getDayName(date, false)}
        </p>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: goal.color }} />
          <span className="font-semibold text-gray-900">{goal.name}</span>
        </div>

        {/* Summary row */}
        <div className="text-xs text-gray-400 mb-4 leading-relaxed">
          <span>Target: <strong className="text-gray-600">{formatAmount(goal.target, goal)}/week</strong></span>
          {alreadyAssigned > 0 && (
            <span className="ml-2">· Already planned: <strong className="text-gray-600">{formatAmount(alreadyAssigned, goal)}</strong></span>
          )}
          {remaining > 0 && (
            <span className="ml-2">· Remaining: <strong style={{ color: goal.color }}>{formatAmount(remaining, goal)}</strong></span>
          )}
        </div>

        <form onSubmit={handleConfirm} className="space-y-4">
          {/* Preset buttons */}
          {presets.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Quick add</p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handlePresetClick(p.value)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                    style={
                      selectedPreset === p.value
                        ? { backgroundColor: goal.color, borderColor: goal.color, color: "white" }
                        : { borderColor: "#e5e7eb", color: "#6b7280" }
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom input */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Custom amount</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.01"
                step="any"
                value={customValue}
                onChange={(e) => handleCustomChange(e.target.value)}
                className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="0"
                autoFocus={presets.length === 0}
              />
              <span className="text-sm text-gray-500">{goalUnitLabel(goal)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className="flex-1 px-3 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-40"
              style={{ backgroundColor: goal.color }}
            >
              Add {canConfirm ? formatAmount(confirmAmount, goal) : ""}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
 
// ─── Formatting helpers ───────────────────────────────────────────────────────

/**
 * Formats an amount for display based on the goal's unit.
 * Hours are shown as minutes when < 1 for readability (0.5 → "30 min").
 */
function formatAmount(amount: number, goal: Goal): string {
  const unit = goalUnitLabel(goal);
  if (goal.amountUnit === "hours") {
    if (amount < 1) return `${Math.round(amount * 60)} min`;
    if (amount === 1) return "1 hr";
    if (Number.isInteger(amount)) return `${amount} hrs`;
    return `${amount} hrs`;
  }
  const display = Number.isInteger(amount) ? amount : +amount.toFixed(2);
  return `${display} ${unit}`;
}

/**
 * Returns up to 5 preset amounts for the amount picker based on unit and remaining.
 * Minutes and hours get time-aware presets; other units get fractional presets.
 */
function getPresets(goal: Goal, remaining: number): Array<{ value: number; label: string }> {
  let candidates: number[] = [];

  if (goal.amountUnit === "minutes") {
    // Common session durations in minutes
    candidates = [5, 10, 15, 20, 25, 30, 40, 45, 60].filter((c) => c <= remaining);
  } else if (goal.amountUnit === "hours") {
    // Common fractions of an hour
    candidates = [0.25, 0.5, 0.75, 1, 1.5, 2, 3].filter((c) => c <= remaining);
  } else {
    // Generic: quarters and halves of the remaining amount
    const fractions = [0.25, 0.5, 0.75];
    candidates = fractions
      .map((f) => Math.round(remaining * f * 10) / 10)
      .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i); // deduplicate
  }

  // Always include "full remaining" unless it's already in the list
  if (remaining > 0 && !candidates.includes(remaining)) {
    candidates.push(remaining);
  }

  return [...new Set(candidates)]
    .slice(0, 5)
    .map((value) => ({ value, label: formatAmount(value, goal) }));
}
