/**
 * TripPanel.tsx — England & Dublin trip cost tracker
 * Logs individual costs (description + amount + date) in a single currency (£)
 * and shows a running total. You convert Dublin's € yourself before entering.
 */

import { useState, useEffect } from "react";
import { db } from "../lib/db";
import type { TripExpense } from "../lib/types";

const todayStr = () => new Date().toISOString().slice(0, 10);

function fmt(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  // YYYY-MM-DD → "Jun 8"
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TripPanel() {
  const [expenses, setExpenses] = useState<TripExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    db.tripExpenses.list().then((data) => {
      setExpenses(data as TripExpense[]);
      setLoading(false);
    });
  }, []);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const add = async () => {
    if (!desc.trim() || !amount) return;
    const expense = { description: desc.trim(), amount: parseFloat(amount), date };
    const saved = await db.tripExpenses.add(expense) as TripExpense;
    setExpenses(e => [saved, ...e]);
    setDesc("");
    setAmount("");
    setDate(todayStr());
    setFormOpen(false);
  };

  const remove = async (id: string) => {
    await db.tripExpenses.delete(id);
    setExpenses(e => e.filter(x => x.id !== id));
  };

  if (loading) {
    return <p className="text-xs text-gray-600 animate-pulse py-10 text-center">Loading…</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">🍀 England &amp; Dublin</h2>
      <p className="text-xs text-gray-500 mb-6">Costs logged in £ — convert Dublin's € before entering.</p>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Total Spent</p>
          <p className="text-3xl font-bold text-white">£{fmt(total)}</p>
          <p className="text-[10px] text-gray-600 mt-1">all costs</p>
        </div>
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-5">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Costs Logged</p>
          <p className="text-3xl font-bold text-white">{expenses.length}</p>
          <p className="text-[10px] text-gray-600 mt-1">{expenses.length === 1 ? "entry" : "entries"}</p>
        </div>
      </div>

      {/* ── Add button ── */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Log</span>
        <button
          onClick={() => setFormOpen(o => !o)}
          className="bg-white text-black px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          + Add Cost
        </button>
      </div>

      {/* ── Add form ── */}
      {formOpen && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">New Cost</p>
          <div className="flex gap-3">
            <input
              autoFocus
              className="flex-1 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
              placeholder="Description (e.g. Train to Dublin)"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onKeyDown={e => e.key === "Enter" && add()}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-28 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
              placeholder="£"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => e.key === "Enter" && add()}
            />
            <input
              type="date"
              className="bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end mt-3">
            <button onClick={() => setFormOpen(false)} className="text-sm text-gray-500 hover:text-gray-300 px-3 py-1.5">Cancel</button>
            <button
              onClick={add}
              disabled={!desc.trim() || !amount}
              className="bg-white text-black px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-40 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* ── Costs list ── */}
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden">
        {expenses.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-10">No costs yet — add your first one.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className="text-left text-[10px] text-gray-600 uppercase tracking-widest px-5 py-3">Description</th>
                <th className="text-left text-[10px] text-gray-600 uppercase tracking-widest px-5 py-3">Date</th>
                <th className="text-right text-[10px] text-gray-600 uppercase tracking-widest px-5 py-3">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {expenses.map((e, i) => (
                <tr key={e.id} className={`group ${i < expenses.length - 1 ? "border-b border-[#1a1a1a]" : ""}`}>
                  <td className="px-5 py-3 text-sm text-white font-medium">{e.description}</td>
                  <td className="px-5 py-3 text-sm text-gray-400">{fmtDate(e.date)}</td>
                  <td className="px-5 py-3 text-sm text-white font-medium text-right">£{fmt(Number(e.amount))}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => remove(e.id)}
                      className="text-gray-700 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all"
                    >✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#2e2e2e]">
                <td colSpan={2} className="px-5 py-3 text-xs text-gray-500">Total</td>
                <td className="px-5 py-3 text-sm font-bold text-white text-right">£{fmt(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
