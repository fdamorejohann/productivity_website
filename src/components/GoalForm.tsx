/**
 * GoalForm.tsx — modal form for creating a new goal.
 *
 * Renders as a full-screen overlay (fixed inset-0) with a centered card.
 * All form state is local — nothing is written until the user submits.
 *
 * The form has two modes controlled by the trackingMode toggle:
 *
 *   frequency  — user sets "sessions per week" + optional session duration.
 *                Logging = +1 per session. Duration is informational only.
 *                Example: "Workout 3x/week · 45 min/session"
 *
 *   cumulative — user sets a total target + unit (hours/pages/dollars/custom).
 *                Logging = user types a decimal amount each time.
 *                Example: "Read 2 hours/week"
 */

import { useState } from "react";
import type { Goal, TrackingMode, AmountUnit, DurationUnit } from "../lib/types";

const AMOUNT_UNITS: AmountUnit[] = ["minutes", "hours", "pages", "dollars", "custom"];
const DURATION_UNITS: DurationUnit[] = ["minutes", "hours"];

// Preset color palette — 9 visually distinct options
const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue (default)
  "#6366f1", // indigo
  "#a855f7", // purple
  "#ec4899", // pink
];

interface Props {
  onSave: (goal: Goal) => void;
  onCancel: () => void;
}

export default function GoalForm({ onSave, onCancel }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("frequency");
  const [target, setTarget] = useState(3);
  const [amountUnit, setAmountUnit] = useState<AmountUnit>("hours");
  const [customUnitLabel, setCustomUnitLabel] = useState("");
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionDurationUnit, setSessionDurationUnit] = useState<DurationUnit>("minutes");
  const [color, setColor] = useState(PRESET_COLORS[5]); // default blue

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const goal: Goal = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      trackingMode,
      target,
      amountUnit,
      customUnitLabel: customUnitLabel.trim(),
      sessionDuration,
      sessionDurationUnit,
      color,
      active: true,
      createdAt: new Date().toISOString(),
    };
    onSave(goal);
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-screen overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">New Goal</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Name ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Workout, Read, Journal"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* ── Description (optional) ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Morning run before breakfast"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ── Tracking mode toggle ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">How to track</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setTrackingMode("frequency")}
                className={`flex-1 px-3 py-2.5 font-medium transition-colors ${
                  trackingMode === "frequency"
                    ? "bg-blue-500 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                Count sessions
              </button>
              <button
                type="button"
                onClick={() => setTrackingMode("cumulative")}
                className={`flex-1 px-3 py-2.5 font-medium transition-colors border-l border-gray-200 ${
                  trackingMode === "cumulative"
                    ? "bg-blue-500 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                Cumulative amount
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {trackingMode === "frequency"
                ? "Log each time you do it. Optionally note a duration per session."
                : "Log an amount each time (e.g. 0.5 hours, 30 pages). Total accumulates."}
            </p>
          </div>

          {/* ── Frequency-specific fields ── */}
          {trackingMode === "frequency" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sessions per week
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={target}
                  onChange={(e) => setTarget(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration per session <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={sessionDuration || ""}
                    placeholder="e.g. 30"
                    onChange={(e) =>
                      setSessionDuration(Math.max(0, parseInt(e.target.value) || 0))
                    }
                    className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={sessionDurationUnit}
                    onChange={(e) => setSessionDurationUnit(e.target.value as DurationUnit)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {DURATION_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ── Cumulative-specific fields ── */}
          {trackingMode === "cumulative" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weekly target</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0.1}
                    step="any"
                    value={target}
                    onChange={(e) =>
                      setTarget(Math.max(0.1, parseFloat(e.target.value) || 0.1))
                    }
                    className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={amountUnit}
                    onChange={(e) => setAmountUnit(e.target.value as AmountUnit)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {AMOUNT_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Custom unit label — only shown when unit === "custom" */}
              {amountUnit === "custom" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit label</label>
                  <input
                    type="text"
                    value={customUnitLabel}
                    onChange={(e) => setCustomUnitLabel(e.target.value)}
                    placeholder="e.g. miles, reps, glasses"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </>
          )}

          {/* ── Color picker ── */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: c,
                    // Ring outline = selected indicator
                    outline: color === c ? `3px solid ${c}` : undefined,
                    outlineOffset: color === c ? "2px" : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: color }}
            >
              Add Goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
