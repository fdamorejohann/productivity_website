/**
 * FoodCostPanel.tsx — Food cost tracker
 * Tracks grocery hauls + meals to compute an all-time cost-per-meal metric.
 */

import { useState, useEffect } from "react";
import { db } from "../lib/db";
import type { GroceryHaul, Meal } from "../lib/types";

const todayStr = () => new Date().toISOString().slice(0, 10);

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  // YYYY-MM-DD → "Jun 8"
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function FoodCostPanel() {
  const [hauls, setHauls] = useState<GroceryHaul[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);

  // Haul form
  const [haulStore, setHaulStore] = useState("");
  const [haulAmount, setHaulAmount] = useState("");
  const [haulDate, setHaulDate] = useState(todayStr());
  const [haulNotes, setHaulNotes] = useState("");
  const [haulOpen, setHaulOpen] = useState(false);

  // Meal form
  const [mealName, setMealName] = useState("");
  const [mealDate, setMealDate] = useState(todayStr());
  const [mealOpen, setMealOpen] = useState(false);

  // Active tab
  const [tab, setTab] = useState<"hauls" | "meals">("hauls");

  useEffect(() => {
    Promise.all([
      db.groceryHauls.list(),
      db.meals.list(),
    ]).then(([h, m]) => {
      setHauls(h as GroceryHaul[]);
      setMeals(m as Meal[]);
      setLoading(false);
    });
  }, []);

  const totalSpend = hauls.reduce((s, h) => s + Number(h.amount), 0);
  const totalMeals = meals.length;
  const costPerMeal = totalMeals > 0 ? totalSpend / totalMeals : null;

  const addHaul = async () => {
    if (!haulStore.trim() || !haulAmount) return;
    const haul = {
      store: haulStore.trim(),
      amount: parseFloat(haulAmount),
      date: haulDate,
      notes: haulNotes.trim(),
    };
    const saved = await db.groceryHauls.add(haul) as GroceryHaul;
    setHauls(h => [saved, ...h]);
    setHaulStore("");
    setHaulAmount("");
    setHaulNotes("");
    setHaulDate(todayStr());
    setHaulOpen(false);
  };

  const deleteHaul = async (id: string) => {
    await db.groceryHauls.delete(id);
    setHauls(h => h.filter(x => x.id !== id));
  };

  const addMeal = async () => {
    if (!mealName.trim()) return;
    const meal = { name: mealName.trim(), date: mealDate };
    const saved = await db.meals.add(meal) as Meal;
    setMeals(m => [saved, ...m]);
    setMealName("");
    setMealDate(todayStr());
    setMealOpen(false);
  };

  const deleteMeal = async (id: string) => {
    await db.meals.delete(id);
    setMeals(m => m.filter(x => x.id !== id));
  };

  if (loading) {
    return <p className="text-xs text-gray-600 animate-pulse py-10 text-center">Loading…</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-6">🛒 Food Cost</h2>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Cost per Meal</p>
          {costPerMeal !== null ? (
            <p className="text-3xl font-bold text-white">${fmt(costPerMeal)}</p>
          ) : (
            <p className="text-lg text-gray-600">—</p>
          )}
          <p className="text-[10px] text-gray-600 mt-1">all time</p>
        </div>
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Total Spent</p>
          <p className="text-3xl font-bold text-white">${fmt(totalSpend)}</p>
          <p className="text-[10px] text-gray-600 mt-1">{hauls.length} {hauls.length === 1 ? "haul" : "hauls"}</p>
        </div>
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Meals Logged</p>
          <p className="text-3xl font-bold text-white">{totalMeals}</p>
          <p className="text-[10px] text-gray-600 mt-1">all time</p>
        </div>
      </div>

      {/* ── Tabs + add buttons ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-1">
          <button
            onClick={() => setTab("hauls")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "hauls" ? "bg-[#2e2e2e] text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            Grocery Hauls
          </button>
          <button
            onClick={() => setTab("meals")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === "meals" ? "bg-[#2e2e2e] text-white" : "text-gray-500 hover:text-gray-300"}`}
          >
            Meals
          </button>
        </div>
        <button
          onClick={() => tab === "hauls" ? setHaulOpen(true) : setMealOpen(true)}
          className="bg-white text-black px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          + Add {tab === "hauls" ? "Haul" : "Meal"}
        </button>
      </div>

      {/* ── Haul form ── */}
      {haulOpen && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">New Grocery Haul</p>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <input
                autoFocus
                className="flex-1 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                placeholder="Store (e.g. Costco)"
                value={haulStore}
                onChange={e => setHaulStore(e.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-32 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                placeholder="Amount $"
                value={haulAmount}
                onChange={e => setHaulAmount(e.target.value)}
              />
              <input
                type="date"
                className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                value={haulDate}
                onChange={e => setHaulDate(e.target.value)}
              />
            </div>
            <input
              className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="Notes (optional)"
              value={haulNotes}
              onChange={e => setHaulNotes(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addHaul()}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setHaulOpen(false)} className="text-sm text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
              <button
                onClick={addHaul}
                disabled={!haulStore.trim() || !haulAmount}
                className="bg-white text-black px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Meal form ── */}
      {mealOpen && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Log a Meal</p>
          <div className="flex gap-3">
            <input
              autoFocus
              className="flex-1 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="Meal name (e.g. Chicken stir fry)"
              value={mealName}
              onChange={e => setMealName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addMeal()}
            />
            <input
              type="date"
              className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              value={mealDate}
              onChange={e => setMealDate(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={() => setMealOpen(false)} className="text-sm text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
              <button
                onClick={addMeal}
                disabled={!mealName.trim()}
                className="bg-white text-black px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hauls list ── */}
      {tab === "hauls" && (
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden">
          {hauls.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-10">No hauls yet — add your first grocery trip.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left text-[10px] text-gray-600 uppercase tracking-widest px-5 py-3">Store</th>
                  <th className="text-left text-[10px] text-gray-600 uppercase tracking-widest px-5 py-3">Date</th>
                  <th className="text-left text-[10px] text-gray-600 uppercase tracking-widest px-5 py-3">Notes</th>
                  <th className="text-right text-[10px] text-gray-600 uppercase tracking-widest px-5 py-3">Amount</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {hauls.map((h, i) => (
                  <tr key={h.id} className={`group ${i < hauls.length - 1 ? "border-b border-[#1a1a1a]" : ""}`}>
                    <td className="px-5 py-3 text-sm text-white font-medium">{h.store}</td>
                    <td className="px-5 py-3 text-sm text-gray-400">{fmtDate(h.date)}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{h.notes || "—"}</td>
                    <td className="px-5 py-3 text-sm text-white font-medium text-right">${fmt(Number(h.amount))}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => deleteHaul(h.id)}
                        className="text-gray-700 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#2e2e2e]">
                  <td colSpan={3} className="px-5 py-3 text-xs text-gray-500">Total</td>
                  <td className="px-5 py-3 text-sm font-bold text-white text-right">${fmt(totalSpend)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      {/* ── Meals list ── */}
      {tab === "meals" && (
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden">
          {meals.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-10">No meals logged yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#2a2a2a]">
                  <th className="text-left text-[10px] text-gray-600 uppercase tracking-widest px-5 py-3">Meal</th>
                  <th className="text-left text-[10px] text-gray-600 uppercase tracking-widest px-5 py-3">Date</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {meals.map((m, i) => (
                  <tr key={m.id} className={`group ${i < meals.length - 1 ? "border-b border-[#1a1a1a]" : ""}`}>
                    <td className="px-5 py-3 text-sm text-white">{m.name}</td>
                    <td className="px-5 py-3 text-sm text-gray-400">{fmtDate(m.date)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => deleteMeal(m.id)}
                        className="text-gray-700 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#2e2e2e]">
                  <td className="px-5 py-3 text-xs text-gray-500">{totalMeals} {totalMeals === 1 ? "meal" : "meals"} total</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
