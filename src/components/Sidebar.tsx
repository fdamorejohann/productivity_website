/**
 * Sidebar.tsx — persistent left navigation panel.
 *
 * Layout (top to bottom):
 *   1. App name + tagline
 *   2. Nav buttons: Dashboard / Planner / Analytics
 *   3. Goals list with active toggle and delete
 *   4. Footer
 *
 * The GoalForm modal is rendered here (as a portal-like overlay) because
 * the "+" button that triggers it lives here. The form itself is a separate
 * component so this file stays focused on layout.
 */

import { useState } from "react";
import type { Goal, View } from "../lib/types";
import GoalForm from "./GoalForm";

interface Props {
  goals: Goal[];
  view: View;
  onViewChange: (view: View) => void;
  onAddGoal: (goal: Goal) => void;
  onDeleteGoal: (id: string) => void;
  /** Passed through to updateGoal in App — used to toggle goal.active */
  onToggleActive: (id: string, updates: Partial<Goal>) => void;
}

// Nav item definitions — icon is a Unicode character, keeps deps minimal
const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "planner",   label: "Planner",   icon: "☰" },
  { id: "analytics", label: "Analytics", icon: "↗" },
  { id: "budget",    label: "Budget",    icon: "$" },
];

export default function Sidebar({
  goals,
  view,
  onViewChange,
  onAddGoal,
  onDeleteGoal,
  onToggleActive,
}: Props) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <aside className="w-60 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col h-screen">

        {/* ── App header ── */}
        <div className="px-5 pt-6 pb-4 border-b border-gray-200">
          <h1 className="text-base font-bold text-gray-900 tracking-tight">Weekly Goals</h1>
          <p className="text-xs text-gray-400 mt-0.5">Track what matters each week</p>
        </div>

        {/* ── Navigation ── */}
        <nav className="px-3 py-3 border-b border-gray-200">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                view === item.id
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* ── Goals list ── */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Goals</span>
            <button
              onClick={() => setShowForm(true)}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 text-sm font-bold transition-colors leading-none"
              title="Add goal"
            >
              +
            </button>
          </div>

          {goals.length === 0 && (
            <p className="text-xs text-gray-400 px-1 py-2">No goals yet. Click + to add one.</p>
          )}

          <div className="space-y-0.5">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg group hover:bg-gray-100 transition-colors"
              >
                {/* Colored dot — click to toggle active/inactive */}
                <button
                  onClick={() => onToggleActive(goal.id, { active: !goal.active })}
                  className="flex-shrink-0 transition-opacity"
                  title={goal.active ? "Mark inactive" : "Mark active"}
                >
                  <span
                    className="block w-2.5 h-2.5 rounded-full transition-opacity"
                    style={{
                      backgroundColor: goal.color,
                      opacity: goal.active ? 1 : 0.3, // dim when inactive
                    }}
                  />
                </button>

                {/* Goal name — dims when inactive */}
                <span
                  className={`flex-1 text-sm truncate ${
                    goal.active ? "text-gray-700" : "text-gray-400"
                  }`}
                >
                  {goal.name}
                </span>

                {/* Delete — only visible on row hover */}
                <button
                  onClick={() => onDeleteGoal(goal.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-base leading-none flex-shrink-0"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-300">Local-first · No sync</p>
        </div>
      </aside>

      {/* GoalForm modal — rendered outside the aside so it overlays the full screen */}
      {showForm && (
        <GoalForm
          onSave={(goal) => {
            onAddGoal(goal);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </>
  );
}
