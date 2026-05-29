/**
 * GoalCard.tsx — progress card for a single goal on the dashboard.
 *
 * Displays:
 *   - Goal name (with color dot) and optional description
 *   - Session duration hint for frequency goals (informational)
 *   - Progress bar (0–100%, filled with goal color)
 *   - "X / Y sessions" or "X / Y hours" count
 *   - Log button
 *
 * Log button behaviour:
 *   frequency  → "+ Log 1" button, immediately fires onLog(id, 1) on click
 *   cumulative → "+ Log" button, expands an inline input to type a decimal amount,
 *                then press ✓ or Enter to confirm (Escape cancels)
 *
 * The `completed` and `percentage` in GoalProgress already account for all
 * CompletionLogs for this week — both dashboard-created and planner-created ones.
 */

import { useState, useRef } from "react";
import type { GoalProgress } from "../lib/types";
import { goalUnitLabel } from "../lib/types";

interface Props {
  progress: GoalProgress;
  onLog: (goalId: string, value: number) => void;
  onDelete: (goalId: string) => void;
}

export default function GoalCard({ progress, onLog, onDelete }: Props) {
  const { goal, completed, percentage } = progress;
  const isCumulative = goal.trackingMode === "cumulative";
  const unitLabel = goalUnitLabel(goal);

  // Controls the inline amount-input shown for cumulative goals
  const [showLogInput, setShowLogInput] = useState(false);
  const [logValue, setLogValue] = useState("1");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleLogClick() {
    if (!isCumulative) {
      // Frequency: log exactly 1 session, no input needed
      onLog(goal.id, 1);
      return;
    }
    // Cumulative: expand input, auto-focus it
    setShowLogInput(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(logValue);
    if (!isNaN(v) && v > 0) {
      onLog(goal.id, v);
      setShowLogInput(false);
      setLogValue("1");
    }
  }

  function handleLogCancel() {
    setShowLogInput(false);
    setLogValue("1");
  }

  // Avoid trailing decimals for display: 2.50 → 2.5, 2 → 2
  const displayCompleted = isCumulative
    ? Number.isInteger(completed) ? completed : +completed.toFixed(2)
    : completed;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">

      {/* ── Header: name + delete ── */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: goal.color }}
          />
          <span className="font-semibold text-gray-900 text-sm truncate">{goal.name}</span>
        </div>
        <button
          onClick={() => onDelete(goal.id)}
          className="text-gray-300 hover:text-red-400 transition-colors ml-2 flex-shrink-0 text-xl leading-none"
          title="Delete goal"
        >
          ×
        </button>
      </div>

      {/* ── Description (if set) ── */}
      {goal.description && (
        <p className="text-xs text-gray-400 mb-2 ml-5 leading-snug line-clamp-2">
          {goal.description}
        </p>
      )}

      {/* ── Session duration hint (frequency goals only) ── */}
      {!isCumulative && goal.sessionDuration > 0 && (
        <p className="text-xs text-gray-400 mb-2 ml-5">
          {goal.sessionDuration} {goal.sessionDurationUnit}/session
        </p>
      )}

      {/* ── Progress bar ── */}
      <div className="flex items-center gap-2 mt-2 mb-2">
        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%`, backgroundColor: goal.color }}
          />
        </div>
        <span className="text-xs text-gray-500 w-8 text-right">{Math.round(percentage)}%</span>
      </div>

      {/* ── Bottom row: count text + log control ── */}
      {!showLogInput ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {displayCompleted} / {goal.target} {unitLabel}
          </span>
          <button
            onClick={handleLogClick}
            className="text-xs px-3 py-1 rounded-full font-medium transition-all hover:opacity-80 active:scale-95"
            style={{ backgroundColor: goal.color + "20", color: goal.color }}
          >
            {isCumulative ? "+ Log" : "+ Log 1"}
          </button>
        </div>
      ) : (
        /* Inline amount input for cumulative goals */
        <form onSubmit={handleLogSubmit} className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <input
            ref={inputRef}
            type="number"
            min="0.01"
            step="any"
            value={logValue}
            onChange={(e) => setLogValue(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && handleLogCancel()}
            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": goal.color } as React.CSSProperties}
            placeholder="0"
          />
          <span className="text-xs text-gray-400 whitespace-nowrap">{unitLabel}</span>
          <button
            type="submit"
            className="text-xs px-2 py-1 rounded-lg font-medium text-white transition-colors"
            style={{ backgroundColor: goal.color }}
          >
            ✓
          </button>
          <button
            type="button"
            onClick={handleLogCancel}
            className="text-xs text-gray-400 hover:text-gray-600 px-1"
          >
            ✕
          </button>
        </form>
      )}
    </div>
  );
}
