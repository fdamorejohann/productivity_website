/**
 * extract-budget.mjs
 * Reads BUDGET (1).xlsx and writes src/data/budget.json
 * Run with: node scripts/extract-budget.mjs
 *
 * Install dep if needed: npm install xlsx
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Dynamically import xlsx (works with both ESM and CJS builds)
const XLSX = await import("xlsx").then(m => m.default ?? m);

const wb = XLSX.readFile(join(root, "BUDGET (1).xlsx"));

// Find the most recent month sheet (last non-CARD sheet)
const monthSheets = wb.SheetNames.filter(n => n !== "CARD USED - LIST");
const sheetName = monthSheets[monthSheets.length - 1]; // e.g. "June"
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

// ── Extract income ──────────────────────────────────────────────────────────
let totalIncome = 0;
let rawFreeSpend = 0;

for (const row of rows) {
  if (row[0] === "Total" && typeof row[1] === "number") {
    totalIncome = row[1];
  }
  if (typeof row[0] === "string" && row[0].toLowerCase().includes("raw free spend")) {
    rawFreeSpend = typeof row[1] === "number" ? row[1] : 0;
  }
}

// ── Extract fixed expenses ──────────────────────────────────────────────────
const FIXED_LABELS = [
  "Rent", "Roth IRA", "Subscriptions", "Phone Bill", "Gym Membership",
  "Internet", "MTA", "Savings", "Seperate Account",
];
const fixedExpenses = [];
let inFixed = false;
let inVariable = false;

const variableExpenses = [];
const VARIABLE_LABELS = [
  "Groceries", "Eating out", "Coffee/ drinks", "Ubers",
  "Fun", "Travel Fund", "Emergency Savings", "Investing", "misc", "claude",
];

for (const row of rows) {
  if (row[0] === "Fixed Expenses") { inFixed = true; inVariable = false; continue; }
  if (row[0] === "Variable Expenses") { inFixed = false; inVariable = true; continue; }

  if (inFixed && FIXED_LABELS.includes(row[0])) {
    fixedExpenses.push({ label: row[0], budget: row[1] ?? 0, actual: row[2] ?? 0 });
  }
  if (inVariable && VARIABLE_LABELS.includes(row[0])) {
    variableExpenses.push({ label: row[0], budget: row[1] ?? 0, actual: row[2] ?? 0 });
  }
}

// ── Savings target & actual ─────────────────────────────────────────────────
const savingsRow = fixedExpenses.find(r => r.label === "Savings");
const separateRow = fixedExpenses.find(r => r.label === "Seperate Account");
const savingsTarget = (savingsRow?.budget ?? 0) + (separateRow?.budget ?? 0);
const savingsActual = (savingsRow?.actual ?? 0) + (separateRow?.actual ?? 0);

// ── Total variable actual spent ─────────────────────────────────────────────
const variableActualSpent = variableExpenses.reduce((s, r) => s + (r.actual ?? 0), 0);
const freeSpendRemaining = rawFreeSpend - variableActualSpent;

// ── Output ──────────────────────────────────────────────────────────────────
const output = {
  month: sheetName,
  extractedAt: new Date().toISOString(),
  totalIncome,
  rawFreeSpend,
  freeSpendRemaining,
  variableActualSpent,
  savingsTarget,
  savingsActual,
  fixedExpenses,
  variableExpenses,
};

await mkdir(join(root, "src/data"), { recursive: true });
await writeFile(join(root, "src/data/budget.json"), JSON.stringify(output, null, 2));

console.log(`✅ Budget extracted from "${sheetName}" sheet`);
console.log(`   Income: $${totalIncome.toLocaleString()}`);
console.log(`   Free to spend: $${freeSpendRemaining.toLocaleString()} / $${rawFreeSpend.toLocaleString()}`);
console.log(`   Savings: $${savingsActual.toLocaleString()} / $${savingsTarget.toLocaleString()}`);
console.log(`   Written to src/data/budget.json`);
