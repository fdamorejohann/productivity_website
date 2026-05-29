import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { db } from "../lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BudgetIncomeRow {
  id: string;
  label: string;
  budget: number;
  actual: number;
}

interface BudgetExpenseRow {
  id: string;
  label: string;
  type: "fixed" | "variable";
  bucket: "spending" | "savings" | "investments";
  budget: number;
  actual: number | null; // null = derive from log; number = manual override
}

interface BudgetExpenseLog {
  id: string;
  vendor: string;
  category: string;
  amount: number;       // what was charged to the card
  card: string;
  date: string;         // YYYY-MM-DD
  owed?: number;        // your effective cost (if set, this is what counts as spent)
  points?: number;      // points multiplier (e.g. 3 = 3× points)
}

interface MonthBudget {
  income: BudgetIncomeRow[];
  expenses: BudgetExpenseRow[];
  logs: BudgetExpenseLog[];
}

type ImportStatus = "import" | "duplicate" | "outside_month" | "invalid" | "credit";

interface ImportPreviewRow {
  id: string;
  raw: Record<string, string>;
  vendor: string;
  category: string;
  amount: number;
  card: string;
  date: string;
  status: ImportStatus;
  reason?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  "Rent", "Roth IRA", "Subscriptions", "Phone Bill", "Gym Membership",
  "Internet", "MTA", "Savings", "Seperate Account", "Emergency Savings",
  "Investing", "Groceries", "Food and drink", "Ubers",
  "Fun", "Travel Fund", "work", "misc", "Rebates",
];

const CARDS = ["Reserve - Chase", "Preferred- Chase", "Freedom", "BOFA", "NONE", "Other"];

const CHART_EXCLUDE = new Set([
  "Rent", "Savings", "Emergency Savings", "Roth IRA", "Seperate Account", "work", "Rebates",
]);

const FOOD_CATS = new Set(["Food and drink", "Groceries"]);
const NO_POINTS_CATS = new Set(["Rebates"]);
const FOOD_DINING_CATS = new Set(["Food and drink", "Groceries"]);

// Per-card points config: available multiplier options + default for a given category
const CARD_POINTS: Record<string, { options: number[]; default: (cat: string) => number }> = {
  "Reserve - Chase":  { options: [8, 5, 4, 3, 1],  default: (c) => FOOD_DINING_CATS.has(c) ? 3 : 1 },
  "Preferred- Chase": { options: [5, 3, 2, 1],    default: (c) => FOOD_DINING_CATS.has(c) ? 3 : 1 },
  "Freedom":          { options: [1.5, 1],         default: () => 1.5 },
  "BOFA":             { options: [1],              default: () => 1 },
};

function defaultPoints(category: string, card: string): number {
  if (NO_POINTS_CATS.has(category)) return 0;
  return CARD_POINTS[card]?.default(category) ?? 1;
}
function pointsOptions(card: string): number[] {
  return CARD_POINTS[card]?.options ?? [1];
}
function effectiveCost(log: BudgetExpenseLog): number {
  return log.owed !== undefined ? log.owed : log.amount;
}

// ─── Default month data ───────────────────────────────────────────────────────

function uid() { return crypto.randomUUID(); }

function defaultMonth(): MonthBudget {
  return {
    income: [
      { id: uid(), label: "Person A - Paycheck 1", budget: 88888.46, actual: 0 },
      { id: uid(), label: "Person A - Paycheck 2", budget: 3696.46, actual: 0 },
      { id: uid(), label: "Person B - Paycheck 1", budget: 0, actual: 0 },
      { id: uid(), label: "Person B - Paycheck 2", budget: 0, actual: 0 },
      { id: uid(), label: "Interest - HYSA 1", budget: 0, actual: 0 },
      { id: uid(), label: "Interest - HYSA 2", budget: 0, actual: 0 },
      { id: uid(), label: "Interest - Checking", budget: 0, actual: 0 },
      { id: uid(), label: "Other 1", budget: 0, actual: 0 },
      { id: uid(), label: "Other 2", budget: 0, actual: 0 },
    ],
    expenses: [
      { id: uid(), label: "Rent",             type: "fixed",    bucket: "spending", budget: 2000, actual: 2000 },
      { id: uid(), label: "Roth IRA",         type: "fixed",    bucket: "investments", budget: 400,  actual: 400 },
      { id: uid(), label: "Subscriptions",    type: "fixed",    bucket: "spending", budget: 135,  actual: 135 },
      { id: uid(), label: "Phone Bill",       type: "fixed",    bucket: "spending", budget: 80,   actual: 80 },
      { id: uid(), label: "Gym Membership",   type: "fixed",    bucket: "spending", budget: 400,  actual: 400 },
      { id: uid(), label: "Internet",         type: "fixed",    bucket: "spending", budget: 0,    actual: 0 },
      { id: uid(), label: "MTA",              type: "fixed",    bucket: "spending", budget: 150,  actual: 150 },
      { id: uid(), label: "Savings",          type: "fixed",    bucket: "savings",  budget: 1500, actual: 1500 },
      { id: uid(), label: "Seperate Account", type: "fixed",    bucket: "savings",  budget: 1000, actual: 1000 },
      { id: uid(), label: "Groceries",        type: "variable", bucket: "spending", budget: 400,  actual: null },
      { id: uid(), label: "Food and drink",   type: "variable", bucket: "spending", budget: 190,  actual: null },
      { id: uid(), label: "Ubers",            type: "variable", bucket: "spending", budget: 150,  actual: null },
      { id: uid(), label: "Fun",              type: "variable", bucket: "spending", budget: 125,  actual: null },
      { id: uid(), label: "Travel Fund",      type: "variable", bucket: "spending", budget: 250,  actual: null },
      { id: uid(), label: "Emergency Savings",type: "variable", bucket: "savings",  budget: 300,  actual: null },
      { id: uid(), label: "Investing",        type: "variable", bucket: "investments", budget: 200,  actual: null },
      { id: uid(), label: "misc",             type: "variable", bucket: "spending", budget: 60,   actual: null },
      { id: uid(), label: "work",             type: "variable", bucket: "spending", budget: 0,    actual: null },
    ],
    logs: [],
  };
}

function normalizeCategoryName(category: string): string {
  const c = category.trim().toLowerCase();
  if (["eating out", "coffee/ drinks", "coffee/drinks", "food & drink", "food and drink", "food & drinks", "restaurants", "restaurant", "bars"].includes(c)) {
    return "Food and drink";
  }
  if (["bills & utilities", "bills and utilities", "bills", "utilities", "shopping", "personal", "fees & adjustments", "fees and adjustments"].includes(c)) {
    return "misc";
  }
  const exact = EXPENSE_CATEGORIES.find(x => x.toLowerCase() === c);
  return exact ?? category;
}

function migrateMonthBudget(data: MonthBudget): MonthBudget {
  return {
    income: data.income,
    expenses: data.expenses.map(row => ({
      ...row,
      label: normalizeCategoryName(row.label),
      bucket: row.bucket ?? (["Roth IRA", "Investing"].includes(normalizeCategoryName(row.label)) ? "investments" : ["Savings", "Seperate Account", "Emergency Savings"].includes(normalizeCategoryName(row.label)) ? "savings" : "spending"),
    })).filter((row, index, rows) => rows.findIndex(r => r.label === row.label && r.type === row.type) === index),
    logs: data.logs.map(log => ({
      ...log,
      category: normalizeCategoryName(log.category),
      amount: Math.abs(log.amount),
    })),
  };
}

function fromTemplate(tmpl: MonthBudget): MonthBudget {
  const normalized = migrateMonthBudget(tmpl);
  return {
    income: normalized.income.map(r => ({ ...r, id: uid(), actual: 0 })),
    expenses: normalized.expenses.map(r => ({ ...r, id: uid(), actual: r.type === "fixed" ? r.budget : null })),
    logs: [],
  };
}

// ─── Month / storage helpers ──────────────────────────────────────────────────

function todayMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function prevMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function bKey(month: string) { return `wg_budget_${month}`; }

function loadBudget(month: string): MonthBudget | null {
  try {
    const raw = localStorage.getItem(bKey(month));
    return raw ? migrateMonthBudget(JSON.parse(raw) as MonthBudget) : null;
  } catch { return null; }
}

function saveBudget(month: string, data: MonthBudget): void {
  localStorage.setItem(bKey(month), JSON.stringify(data));
}

function migrateAllLogsToReserve(): void {
  const keys = Object.keys(localStorage).filter(k => k.startsWith("wg_budget_"));
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw) as MonthBudget;
      const updated: MonthBudget = {
        ...data,
        logs: data.logs.map(l => ({
          ...l,
          card: "Reserve - Chase",
          points: defaultPoints(l.category, "Reserve - Chase"),
        })),
      };
      localStorage.setItem(key, JSON.stringify(updated));
    } catch { /* skip corrupted entries */ }
  }
  localStorage.setItem("wg_reserve_card_migration", "1");
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── CSV import helpers ───────────────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  cells.push(current.trim());
  return cells.map(c => c.replace(/^"|"$/g, ""));
}

function parseCsvText(text: string): Record<string, string>[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
}

function parseCsvFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read CSV file"));
    reader.onload = () => resolve(parseCsvText(String(reader.result ?? "")));
    reader.readAsText(file);
  });
}

function findColumn(row: Record<string, string>, names: string[]): string {
  const keys = Object.keys(row);
  const found = keys.find(k => names.some(n => k.trim().toLowerCase() === n.trim().toLowerCase()));
  return found ? row[found] ?? "" : "";
}

function normalizeDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (slash) {
    const [, m, d, yRaw] = slash;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(v);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function parseAmount(value: string): number | null {
  const cleaned = value
    .replace(/\$/g, "")
    .replace(/,/g, "")
    .replace(/\(([^)]+)\)/, "-$1")
    .trim();

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function categorizeVendor(vendor: string): string {
  const v = vendor.toUpperCase();

  if (/\b(MTA|OMNY|NYCT|SUBWAY)\b/.test(v)) return "MTA";
  if (/\b(LYFT|UBER)\b/.test(v)) return "Ubers";
  if (/\b(WHOLE FOODS|TRADER JOE|GROCERY|MARKET)\b/.test(v)) return "Groceries";
  if (/(STARBUCKS|COFFEE|CAFE|BAKERY|RESTAURANT|BAR|GRILL|PIZZA|TACOS|FISHBAR|SWEETGREEN|CHIPOTLE|PUB|TST\*)/.test(v)) return "Food and drink";
  if (/\b(INDUSTRIOUS|COMMONS|COWORKING)\b/.test(v)) return "work";
  if (/\b(PRIME|NETFLIX|SPOTIFY|APPLE\.COM|SUBSCRIPTION)\b/.test(v)) return "Subscriptions";

  return "misc";
}

function matchingCategory(value: string): string | null {
  const normalized = normalizeCategoryName(value);
  const lower = normalized.trim().toLowerCase();
  return EXPENSE_CATEGORIES.find(c => c.toLowerCase() === lower) ?? null;
}

function duplicateKey(date: string, vendor: string, amount: number, card: string): string {
  return `${date}|${vendor.trim().toLowerCase()}|${Math.abs(amount).toFixed(2)}|${card.trim().toLowerCase()}`;
}

function buildImportPreview(
  rows: Record<string, string>[],
  data: MonthBudget,
  month: string,
  includeCredits: boolean
): ImportPreviewRow[] {
  const existingKeys = new Set(
    data.logs.map(l => duplicateKey(l.date, l.vendor, l.amount, l.card))
  );

  return rows.map(raw => {
    const rawDate = findColumn(raw, ["Transaction Date", "Post Date", "Date"]);
    const rawVendor = findColumn(raw, ["Vendor", "Vender", "Merchant", "Merchent", "Description", "Name", "Payee"]);
    const rawAmount = findColumn(raw, ["Amount", "Transaction Amount"]);
    const rawCategory = findColumn(raw, ["Category"]);
    const rawCard = findColumn(raw, ["Account", "Card", "Account Name"]);

    const date = normalizeDate(rawDate) ?? "";
    const vendor = rawVendor.trim() || "Unknown Vendor";
    const amountParsed = parseAmount(rawAmount);
    const card = rawCard.trim() || "Chase";
    const csvCategory = matchingCategory(rawCategory);
    const category = csvCategory ?? categorizeVendor(vendor);

    // Chase exports are inverted:
    // negative amount = charge/spending
    // positive amount = payment/refund/credit
    const isCreditOrPayment = amountParsed !== null && amountParsed > 0;
    const normalizedExpenseAmount = amountParsed === null ? 0 : Math.abs(amountParsed);

    let status: ImportStatus = "import";
    let reason = "Ready to import";

    if (!date || amountParsed === null || amountParsed === 0) {
      status = "invalid";
      reason = "Invalid date or amount";
    } else if (!date.startsWith(month)) {
      status = "outside_month";
      reason = `Outside ${formatMonthLabel(month)}`;
    } else if (category === "MTA" && normalizedExpenseAmount < 5) {
      status = "credit";
      reason = "Small MTA fare skipped";
    } else if (isCreditOrPayment && !includeCredits) {
      status = "credit";
      reason = "Payment/refund skipped";
    } else if (existingKeys.has(duplicateKey(date, vendor, normalizedExpenseAmount, card))) {
      status = "duplicate";
      reason = "Already exists";
    }

    return {
      id: uid(),
      raw,
      vendor,
      category,
      amount: normalizedExpenseAmount,
      card,
      date,
      status,
      reason,
    };
  });
}

// ─── BudgetPanel ──────────────────────────────────────────────────────────────

export default function BudgetPanel() {
  const [month, setMonth] = useState<string>(todayMonthKey);
  const [data, setData] = useState<MonthBudget | null>(null);

  // One-time migration: set all existing logs to Reserve - Chase with correct points
  useEffect(() => {
    if (!localStorage.getItem("wg_reserve_card_migration")) {
      migrateAllLogsToReserve();
    }
  }, []);

  const [importRows, setImportRows] = useState<ImportPreviewRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [includeCredits, setIncludeCredits] = useState(false);
  const [importError, setImportError] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setData(null);
    setImportRows([]);
    setImportFileName("");
    setImportError("");
    db.budget.get(month).then((stored: MonthBudget | null) => {
      if (stored) {
        setData(migrateMonthBudget(stored));
      } else if (month === todayMonthKey()) {
        const fresh = defaultMonth();
        db.budget.save(month, fresh);
        setData(fresh);
      }
    });
  }, [month]);

  useEffect(() => {
    if (!data) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      db.budget.save(month, data);
      // Recompute and save summary values
      const eAct = (r: BudgetExpenseRow) => expActual(r, data.logs);
      const fixedRows = data.expenses.filter(r => r.type === "fixed");
      const variableRows = data.expenses.filter(r => r.type === "variable" && r.label !== "work");
      const incomeAct = data.income.reduce((s, r) => s + r.actual, 0);
      const fixedAct = fixedRows.reduce((s, r) => s + eAct(r), 0);
      const rebates = data.logs.filter(l => l.category === "Rebates").reduce((s, l) => s + effectiveCost(l), 0);
      const varAct = variableRows.reduce((s, r) => s + eAct(r), 0) - rebates;
      const leftover = incomeAct - fixedAct - varAct;
      const savings = data.expenses.filter(r => r.bucket === "savings").reduce((s, r) => s + eAct(r), 0);
      const investments = data.expenses.filter(r => r.bucket === "investments").reduce((s, r) => s + eAct(r), 0);
      db.summary.upsert(month, "leftover", leftover);
      db.summary.upsert(month, "savings", savings);
      db.summary.upsert(month, "investments", investments);
    }, 800);
  }, [data, month]);

  useEffect(() => {
    if (!data || importRows.length === 0) return;
    const rawRows = importRows.map(r => r.raw);
    setImportRows(buildImportPreview(rawRows, data, month, includeCredits));
  }, [includeCredits]);

  function upd(fn: (d: MonthBudget) => MonthBudget) {
    setData(prev => prev ? fn(prev) : prev);
  }

  function expActual(row: BudgetExpenseRow, logs: BudgetExpenseLog[]): number {
    if (row.actual !== null) return row.actual;
    const lbl = row.label.toLowerCase();
    return logs.filter(l => l.category.toLowerCase() === lbl).reduce((s, l) => s + effectiveCost(l), 0);
  }

  async function handleImportCsv(file: File | null) {
    if (!file || !data) return;
    setImportError("");
    setImportFileName(file.name);

    try {
      const rows = await parseCsvFile(file);
      setImportRows(buildImportPreview(rows, data, month, includeCredits));
    } catch (err) {
      setImportRows([]);
      setImportError(err instanceof Error ? err.message : "Could not import CSV");
    }
  }

  function clearImport() {
    setImportRows([]);
    setImportFileName("");
    setImportError("");
  }

  function updateImportRow(id: string, patch: Partial<ImportPreviewRow>) {
    setImportRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));
  }

  function commitImportRows() {
    const validRows = importRows.filter(r => r.status === "import");
    if (validRows.length === 0) return;

    upd(d => ({
      ...d,
      logs: [
        ...d.logs,
        ...validRows.map(r => ({
          id: uid(),
          vendor: r.vendor,
          category: r.category,
          amount: Math.abs(r.amount),
          card: r.card,
          date: r.date,
        })),
      ],
    }));

    clearImport();
  }

  const isCurrentMonth = month === todayMonthKey();
  const nextKey = nextMonthKey(month);

  // Totals — computed here with null-safe access; re-derived after guard with non-null data
  const incomeBudget = data?.income.reduce((s, r) => s + r.budget, 0) ?? 0;
  const incomeActual = data?.income.reduce((s, r) => s + r.actual, 0) ?? 0;

  // Chart
  const spendMap = new Map<string, number>();
  if (data) {
    for (const l of data.logs) {
      if (!CHART_EXCLUDE.has(l.category) && l.category !== "work") {
        spendMap.set(l.category, (spendMap.get(l.category) ?? 0) + effectiveCost(l));
      }
    }
  }
  const spendEntries = [...spendMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxSpend = Math.max(...spendEntries.map(([, v]) => v), 1);

  // Top 10
  const foodLogs = data
    ? [...data.logs].filter(l => FOOD_CATS.has(l.category)).sort((a, b) => b.amount - a.amount).slice(0, 10)
    : [];
  const drinkLogs = data
    ? [...data.logs].filter(l => l.category === "Food and drink").sort((a, b) => b.amount - a.amount).slice(0, 10)
    : [];

  // Add form state
  const [vendor, setVendor] = useState("");
  const [category, setCategory] = useState("Groceries");
  const [amount, setAmount] = useState("");
  const [owed, setOwed] = useState("");
  const [card, setCard] = useState(CARDS[0]);
  const [formPoints, setFormPoints] = useState(defaultPoints("Groceries", CARDS[0]));
  const [logDate, setLogDate] = useState(localDateStr);
  const [logFilter, setLogFilter] = useState<string>("All");
  const [vendorSearch, setVendorSearch] = useState("");

  function handleAddLog(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!vendor.trim() || isNaN(amt) || amt <= 0 || !data) return;
    const owedAmt = parseFloat(owed);
    upd(d => ({
      ...d,
      logs: [...d.logs, {
        id: uid(), vendor: vendor.trim(), category, amount: amt, card, date: logDate,
        owed: !isNaN(owedAmt) && owedAmt > 0 ? owedAmt : undefined,
        points: formPoints,
      }],
    }));
    setVendor("");
    setAmount("");
    setOwed("");
  }

  function createMonth() {
    const prev = loadBudget(prevMonthKey(month));
    const fresh = prev ? fromTemplate(prev) : defaultMonth();
    saveBudget(month, fresh);
    setData(fresh);
  }

  function createNextMonth() {
    if (!loadBudget(nextKey)) {
      const fresh = data ? fromTemplate(data) : defaultMonth();
      saveBudget(nextKey, fresh);
    }
    setMonth(nextKey);
  }

  function exportCsv() {
    if (!data) return;
    const headers = ["Date", "Vendor", "Category", "Amount", "Owed", "Effective Cost", "Pts Multiplier", "Pts Earned", "Card"];
    const rows = [...data.logs]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(l => {
        const cost = effectiveCost(l);
        const mult = l.points ?? defaultPoints(l.category, l.card);
        return [
          l.date,
          `"${l.vendor.replace(/"/g, '""')}"`,
          l.category,
          l.amount.toFixed(2),
          (l.owed ?? 0).toFixed(2),
          cost.toFixed(2),
          mult,
          Math.round(cost * mult),
          `"${l.card.replace(/"/g, '""')}"`,
        ];
      });
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetCurrentMonth() {
    if (!window.confirm(`Reset ${formatMonthLabel(month)} to the default budget and remove all logs?`)) return;
    const fresh = defaultMonth();
    saveBudget(month, fresh);
    setData(fresh);
    clearImport();
  }

  // Shared expense handlers (operate on the full expenses array by id)
  const expHandlers = {
    updateLabel: (id: string, label: string) =>
      upd(d => ({ ...d, expenses: d.expenses.map(r => r.id === id ? { ...r, label } : r) })),
    updateBudget: (id: string, budget: number) =>
      upd(d => ({ ...d, expenses: d.expenses.map(r => r.id === id ? { ...r, budget } : r) })),
    updateActual: (id: string, actual: number | null) =>
      upd(d => ({ ...d, expenses: d.expenses.map(r => r.id === id ? { ...r, actual } : r) })),
    updateBucket: (id: string, bucket: "spending" | "savings" | "investments") =>
      upd(d => ({ ...d, expenses: d.expenses.map(r => r.id === id ? { ...r, bucket } : r) })),
    deleteRow: (id: string) =>
      upd(d => ({ ...d, expenses: d.expenses.filter(r => r.id !== id) })),
  };

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="p-8 max-w-6xl mx-auto bg-[#111] min-h-screen">
        <BudgetHeader
          month={month} isCurrentMonth={isCurrentMonth}
          showNewMonth={false}
          onPrev={() => setMonth(prevMonthKey(month))}
          onNext={() => setMonth(nextMonthKey(month))}
          onNewMonth={createNextMonth}
          onResetMonth={createMonth}
          onExport={exportCsv}
        />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-5xl mb-4">📅</div>
          <p className="text-xl font-semibold text-gray-200 mb-2">{formatMonthLabel(month)}</p>
          <p className="text-sm text-gray-500 mb-6">No budget data for this month yet.</p>
          <button onClick={createMonth} className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 transition-colors">
            Create Budget
          </button>
        </div>
      </div>
    );
  }

  const fixedRows = data.expenses.filter(r => r.type === "fixed");
  const variableRows = data.expenses.filter(r => r.type === "variable");
  const filteredLogs = data.logs
    .filter(l => logFilter === "All" || l.category === logFilter)
    .filter(l => !vendorSearch || l.vendor.toLowerCase().includes(vendorSearch.toLowerCase()));

  // ── Summary totals ───────────────────────────────────────────────────────────
  const fixedBudgetTotal = fixedRows.reduce((s, r) => s + r.budget, 0);
  const fixedActualTotal = fixedRows.reduce((s, r) => s + expActual(r, data.logs), 0);

  const variableNoWork = variableRows.filter(r => r.label !== "work");
  const variableBudgetTotal = variableNoWork.reduce((s, r) => s + r.budget, 0);
  const rebateActual = data.logs.filter(l => l.category === "Rebates").reduce((s, l) => s + effectiveCost(l), 0);
  const variableActualTotal = variableNoWork.reduce((s, r) => s + expActual(r, data.logs), 0) - rebateActual;

  const leftoverBudget = incomeBudget - fixedBudgetTotal - variableBudgetTotal;
  const leftoverActual = incomeActual - fixedActualTotal - variableActualTotal;

  const savingsExpRows = data.expenses.filter(r => r.bucket === "savings");
  const savingsBudget = savingsExpRows.reduce((s, r) => s + r.budget, 0);
  const savingsActual = savingsExpRows.reduce((s, r) => s + expActual(r, data.logs), 0);

  const investingExpRows = data.expenses.filter(r => r.bucket === "investments");
  const investingBudget = investingExpRows.reduce((s, r) => s + r.budget, 0);
  const investingActual = investingExpRows.reduce((s, r) => s + expActual(r, data.logs), 0);

  const totalBudget = savingsBudget + investingBudget + leftoverBudget;
  const totalActual = savingsActual + investingActual + leftoverActual;


  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 bg-[#111] min-h-screen">

      {/* Header */}
      <BudgetHeader
        month={month} isCurrentMonth={isCurrentMonth}
        showNewMonth={isCurrentMonth && !loadBudget(nextKey)}
        onPrev={() => setMonth(prevMonthKey(month))}
        onNext={() => setMonth(nextMonthKey(month))}
        onNewMonth={createNextMonth}
        onResetMonth={resetCurrentMonth}
        onExport={exportCsv}
      />

      {/* Summary cards */}
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard label="Income" actual={incomeActual} budget={incomeBudget} higherIsBetter />
          <SummaryCard label="Fixed Expenses" actual={fixedActualTotal} budget={fixedBudgetTotal} higherIsBetter={false} />
          <SummaryCard label="Variable Expenses" actual={variableActualTotal} budget={variableBudgetTotal} higherIsBetter={false} />
        </div>

        <div className="grid grid-cols-4 gap-4 pl-8">
          <SummaryCard label="Leftover" actual={leftoverActual} budget={leftoverBudget} higherIsBetter />
          <SummaryCard label="Savings" actual={savingsActual} budget={savingsBudget} higherIsBetter />
          <SummaryCard label="Investments" actual={investingActual} budget={investingBudget} higherIsBetter />
          <SummaryCard label="Total" actual={totalActual} budget={totalBudget} higherIsBetter />
        </div>
      </div>

      {/* Income + Top Spend chart */}
      <div className="grid grid-cols-2 gap-6 items-start">
        <IncomeTable
          rows={data.income}
          onAddRow={() => upd(d => ({ ...d, income: [...d.income, { id: uid(), label: "Income", budget: 0, actual: 0 }] }))}
          onUpdateLabel={(id, label) => upd(d => ({ ...d, income: d.income.map(r => r.id === id ? { ...r, label } : r) }))}
          onUpdateBudget={(id, budget) => upd(d => ({ ...d, income: d.income.map(r => r.id === id ? { ...r, budget } : r) }))}
          onUpdateActual={(id, actual) => upd(d => ({ ...d, income: d.income.map(r => r.id === id ? { ...r, actual } : r) }))}
          onDeleteRow={(id) => upd(d => ({ ...d, income: d.income.filter(r => r.id !== id) }))}
        />

        <div className="bg-[#1e1e1e] rounded-2xl border border-[#2e2e2e] p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4">Top Spend Categories</h2>
          {spendEntries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400">
              No spending logged yet
            </div>
          ) : (
            <div className="space-y-3">
              {spendEntries.map(([cat, amt]) => (
                <div key={cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700">{cat}</span>
                    <span className="text-gray-500 tabular-nums">{fmt(amt)}</span>
                  </div>
                  <div className="bg-[#2a2a2a] rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${Math.max(4, (amt / maxSpend) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fixed + Variable expense tables */}
      <div className="grid grid-cols-2 gap-6 items-start">
        <ExpenseTable
          title="Fixed Expenses"
          rows={fixedRows}
          getActual={r => expActual(r, data.logs)}
          onAddRow={() => upd(d => ({ ...d, expenses: [...d.expenses, { id: uid(), label: "Expense", type: "fixed", bucket: "spending", budget: 0, actual: 0 }] }))}
          onUpdateLabel={expHandlers.updateLabel}
          onUpdateBudget={expHandlers.updateBudget}
          onUpdateActual={expHandlers.updateActual}
          onUpdateBucket={expHandlers.updateBucket}
          onDeleteRow={expHandlers.deleteRow}
        />
        <ExpenseTable
          title="Variable Expenses"
          rows={variableRows}
          getActual={r => expActual(r, data.logs)}
          onAddRow={() => upd(d => ({ ...d, expenses: [...d.expenses, { id: uid(), label: "Expense", type: "variable", bucket: "spending", budget: 0, actual: null }] }))}
          onUpdateLabel={expHandlers.updateLabel}
          onUpdateBudget={expHandlers.updateBudget}
          onUpdateActual={expHandlers.updateActual}
          onUpdateBucket={expHandlers.updateBucket}
          onDeleteRow={expHandlers.deleteRow}
        />
      </div>

      {/* Top 10 Food + Drinks — only once logs exist */}
      {(foodLogs.length > 0 || drinkLogs.length > 0) && (
        <div className="grid grid-cols-2 gap-6 items-start">
          <Top10Table title="Top 10 Most Expensive Food + Groceries" logs={foodLogs} />
          <Top10Table title="Top 10 Most Expensive Food and Drink" logs={drinkLogs} />
        </div>
      )}

      {/* Import CSV */}
      <ImportCsvPanel
        fileName={importFileName}
        rows={importRows}
        includeCredits={includeCredits}
        importError={importError}
        onToggleIncludeCredits={setIncludeCredits}
        onFileSelected={handleImportCsv}
        onUpdateRow={updateImportRow}
        onClear={clearImport}
        onImport={commitImportRows}
      />

      {/* Add Expense form */}
      <div className="bg-[#1e1e1e] rounded-2xl border border-[#2e2e2e] p-5">
        <h2 className="text-sm font-semibold text-gray-200 mb-4">Add Expense</h2>
        <form onSubmit={handleAddLog} className="flex flex-wrap gap-3 items-end">
          <FormField label="Vendor">
            <input
              type="text"
              value={vendor}
              onChange={e => setVendor(e.target.value)}
              placeholder="e.g. Whole Foods"
              className="w-36 border border-[#333] rounded-lg px-3 py-1.5 text-sm bg-[#252525] text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </FormField>
          <FormField label="Category">
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setFormPoints(defaultPoints(e.target.value, card)); }}
              className="w-44 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-[#252525] text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Amount ($)">
            <input
              type="number"
              min="0.01"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-28 border border-[#333] rounded-lg px-3 py-1.5 text-sm bg-[#252525] text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </FormField>
          <FormField label="Owed ($)">
            <input
              type="number"
              min="0.01"
              step="any"
              value={owed}
              onChange={e => setOwed(e.target.value)}
              placeholder="0.00"
              className="w-24 border border-[#333] rounded-lg px-3 py-1.5 text-sm bg-[#252525] text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </FormField>
          <FormField label="Card">
            <select
              value={card}
              onChange={e => { setCard(e.target.value); setFormPoints(defaultPoints(category, e.target.value)); }}
              className="w-40 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-[#252525] text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CARDS.map(c => <option key={c}>{c}</option>)}
            </select>
          </FormField>
          <FormField label="Date">
            <input
              type="date"
              value={logDate}
              onChange={e => setLogDate(e.target.value)}
              className="border border-[#333] rounded-lg px-3 py-1.5 text-sm bg-[#252525] text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </FormField>
          <button
            type="submit"
            disabled={!vendor.trim() || !amount}
            className="px-4 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-40 self-end mb-0.5"
          >
            Add
          </button>
        </form>
      </div>

      {/* Expense log */}
      {data.logs.length > 0 && (
        <div className="bg-[#1e1e1e] rounded-2xl border border-[#2e2e2e] p-5">
          <div className="flex items-center justify-between mb-4 gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Expense Log</h2>
              <span className="text-xs text-gray-400">
                {filteredLogs.length} entries · {fmt(filteredLogs.reduce((s, l) => s + effectiveCost(l), 0))} total ·{" "}
                {Math.round(filteredLogs.reduce((s, l) => s + effectiveCost(l) * (l.points ?? defaultPoints(l.category, l.card)), 0)).toLocaleString()} pts
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                placeholder="Search vendor…"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 w-36"
              />
              <select
                value={logFilter}
                onChange={e => setLogFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-[#252525] text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All</option>
                {Array.from(new Set(data.logs.map(l => l.category)))
                  .sort()
                  .map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-gray-500 border-b border-[#2a2a2a]">
                  <th className="text-left pb-2 pr-4">Date</th>
                  <th className="text-left pb-2 pr-4">Vendor</th>
                  <th className="text-left pb-2 pr-4">Category</th>
                  <th className="text-right pb-2 pr-4">Amount</th>
                  <th className="text-right pb-2 pr-4">Owed</th>
                  <th className="text-left pb-2 pr-4">Card</th>
                  <th className="text-right pb-2 pr-4">Pts ×</th>
                  <th className="pb-2 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {[...filteredLogs]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(log => (
                    <LogRow
                      key={log.id}
                      log={log}
                      onUpdate={(patch) => upd(d => ({ ...d, logs: d.logs.map(l => l.id === log.id ? { ...l, ...patch } : l) }))}
                      onDelete={() => upd(d => ({ ...d, logs: d.logs.filter(l => l.id !== log.id) }))}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ImportCsvPanel ───────────────────────────────────────────────────────────

function ImportCsvPanel({ fileName, rows, includeCredits, importError, onToggleIncludeCredits, onFileSelected, onUpdateRow, onClear, onImport }: {
  fileName: string;
  rows: ImportPreviewRow[];
  includeCredits: boolean;
  importError: string;
  onToggleIncludeCredits: (v: boolean) => void;
  onFileSelected: (file: File | null) => void;
  onUpdateRow: (id: string, patch: Partial<ImportPreviewRow>) => void;
  onClear: () => void;
  onImport: () => void;
}) {
  const importable = rows.filter(r => r.status === "import");
  const duplicates = rows.filter(r => r.status === "duplicate").length;
  const skipped = rows.length - importable.length - duplicates;
  const total = importable.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="bg-[#1e1e1e] rounded-2xl border border-[#2e2e2e] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Import CSV</h2>
          <p className="text-xs text-gray-500 mt-1">Upload a Chase CSV for this month. Chase charges are treated as negative values and converted to positive expenses.</p>
        </div>
        {rows.length > 0 && (
          <button onClick={onClear} className="text-xs text-gray-400 hover:text-red-500 font-medium">Clear</button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <FormField label="CSV File">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={e => onFileSelected(e.target.files?.[0] ?? null)}
            className="block w-72 text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-blue-600 hover:file:bg-blue-100"
          />
        </FormField>

        <label className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <input
            type="checkbox"
            checked={includeCredits}
            onChange={e => onToggleIncludeCredits(e.target.checked)}
            className="rounded border-gray-300"
          />
          Include payments/refunds/credits
        </label>

        {fileName && <div className="text-xs text-gray-400 mb-2">Selected: {fileName}</div>}
      </div>

      {importError && <p className="text-xs text-red-500 mt-3">{importError}</p>}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 mb-3">
            <div className="text-xs text-gray-500">
              {rows.length} rows found · {importable.length} ready · {duplicates} duplicates · {skipped} skipped · {fmt(total)} total
            </div>
            <button
              onClick={onImport}
              disabled={importable.length === 0}
              className="px-4 py-1.5 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-40"
            >
              Import {importable.length} rows
            </button>
          </div>

          <div className="max-h-80 overflow-auto border border-[#2e2e2e] rounded-xl">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#1e1e1e]">
                <tr className="text-xs font-medium text-gray-500 border-b border-[#2a2a2a]">
                  <th className="text-left py-2 px-3">Date</th>
                  <th className="text-left py-2 px-3">Vendor</th>
                  <th className="text-left py-2 px-3">Category</th>
                  <th className="text-right py-2 px-3">Amount</th>
                  <th className="text-left py-2 px-3">Card</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-b border-[#2a2a2a] hover:bg-[#252525]">
                    <td className="py-1.5 px-3 text-xs text-gray-500 whitespace-nowrap">{row.date || "—"}</td>
                    <td className="py-1.5 px-3 text-xs text-gray-200 max-w-56 truncate">{row.vendor}</td>
                    <td className="py-1.5 px-3 text-xs text-gray-500">
                      <select
                        value={row.category}
                        onChange={e => onUpdateRow(row.id, { category: e.target.value })}
                        disabled={row.status !== "import"}
                        className="w-40 border border-[#333] rounded-lg px-2 py-1 text-xs bg-[#252525] text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
                      >
                        {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-3 text-right text-xs font-medium text-gray-800 tabular-nums">{fmt(row.amount)}</td>
                    <td className="py-1.5 px-3 text-xs text-gray-400 whitespace-nowrap">{row.card}</td>
                    <td className="py-1.5 px-3 text-xs whitespace-nowrap">
                      <ImportStatusBadge status={row.status} reason={row.reason} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function ImportStatusBadge({ status, reason }: { status: ImportStatus; reason?: string }) {
  const classes: Record<ImportStatus, string> = {
    import: "bg-green-50 text-green-700",
    duplicate: "bg-gray-100 text-gray-500",
    outside_month: "bg-yellow-50 text-yellow-700",
    invalid: "bg-red-50 text-red-600",
    credit: "bg-purple-50 text-purple-600",
  };

  const label: Record<ImportStatus, string> = {
    import: "import",
    duplicate: "duplicate",
    outside_month: "outside month",
    invalid: "invalid",
    credit: "skipped",
  };

  return (
    <span title={reason} className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${classes[status]}`}>
      {label[status]}
    </span>
  );
}

// ─── BudgetHeader ─────────────────────────────────────────────────────────────

function BudgetHeader({ month, isCurrentMonth, showNewMonth, onPrev, onNext, onNewMonth, onResetMonth, onExport }: {
  month: string;
  isCurrentMonth: boolean;
  showNewMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
  onNewMonth: () => void;
  onResetMonth: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold text-white">Budget</h1>
      <div className="flex items-center gap-3">
        {showNewMonth && (
          <button onClick={onNewMonth} className="px-3 py-1.5 text-sm font-medium text-blue-400 border border-blue-800 rounded-lg hover:bg-blue-900/30 transition-colors">
            + New Month
          </button>
        )}
        <button onClick={onExport} className="px-3 py-1.5 text-sm font-medium text-gray-300 border border-[#333] rounded-lg hover:bg-[#2a2a2a] transition-colors">
          Export CSV
        </button>
        <button onClick={onResetMonth} className="px-3 py-1.5 text-sm font-medium text-red-400 border border-red-900 rounded-lg hover:bg-red-900/30 transition-colors">
          Reset Month
        </button>
        <div className="flex items-center gap-1">
          <button onClick={onPrev} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2a2a2a] transition-colors text-lg leading-none">&#8592;</button>
          <div className="text-center min-w-36">
            <div className="text-sm font-semibold text-gray-200">{formatMonthLabel(month)}</div>
            {isCurrentMonth && <div className="text-xs text-blue-400">Current Month</div>}
          </div>
          <button onClick={onNext} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#2a2a2a] transition-colors text-lg leading-none">&#8594;</button>
        </div>
      </div>
    </div>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({ label, actual, budget, higherIsBetter }: {
  label: string; actual: number; budget: number; higherIsBetter: boolean;
}) {
  const both0 = actual === 0 && budget === 0;
  const isGood = higherIsBetter ? actual >= budget : actual <= budget;
  const color = both0 ? "#6b7280" : isGood ? "#22c55e" : "#ef4444";
  return (
    <div className="bg-[#1e1e1e] rounded-2xl border border-[#2e2e2e] p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>{fmt(actual)}</p>
      <p className="text-xs text-gray-600 mt-0.5">budget {fmt(budget)}</p>
    </div>
  );
}

// ─── IncomeTable ──────────────────────────────────────────────────────────────

function IncomeTable({ rows, onAddRow, onUpdateLabel, onUpdateBudget, onUpdateActual, onDeleteRow }: {
  rows: BudgetIncomeRow[];
  onAddRow: () => void;
  onUpdateLabel: (id: string, v: string) => void;
  onUpdateBudget: (id: string, v: number) => void;
  onUpdateActual: (id: string, v: number) => void;
  onDeleteRow: (id: string) => void;
}) {
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  return (
    <div className="bg-[#1e1e1e] rounded-2xl border border-[#2e2e2e] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-200">Income</h2>
        <button onClick={onAddRow} className="text-xs text-blue-400 hover:text-blue-300 font-medium">+ Add row</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs font-medium text-gray-500 border-b border-[#2a2a2a]">
            <th className="text-left pb-2">Source</th>
            <th className="text-right pb-2 pr-1">Budget</th>
            <th className="text-right pb-2 pr-1">Actual</th>
            <th className="text-left pb-2 pr-1">Bucket</th>
            <th className="pb-2 w-5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <IncomeRow
              key={row.id}
              row={row}
              onUpdateLabel={v => onUpdateLabel(row.id, v)}
              onUpdateBudget={v => onUpdateBudget(row.id, v)}
              onUpdateActual={v => onUpdateActual(row.id, v)}
              onDelete={() => onDeleteRow(row.id)}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="text-xs font-semibold text-gray-300 border-t border-[#2a2a2a]">
            <td className="pt-2">Total</td>
            <td className="text-right pt-2 pr-1 tabular-nums">{fmt(totalBudget)}</td>
            <td className="text-right pt-2 pr-1 tabular-nums">{fmt(totalActual)}</td>
            <td></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function IncomeRow({ row, onUpdateLabel, onUpdateBudget, onUpdateActual, onDelete }: {
  row: BudgetIncomeRow;
  onUpdateLabel: (v: string) => void;
  onUpdateBudget: (v: number) => void;
  onUpdateActual: (v: number) => void;
  onDelete: () => void;
}) {
  return (
    <tr className="group border-b border-[#2a2a2a] hover:bg-[#252525]">
      <td className="py-1.5 pr-2"><EditableText value={row.label} onChange={onUpdateLabel} /></td>
      <td className="py-1.5 text-right pr-1"><EditableAmount value={row.budget} onChange={onUpdateBudget} /></td>
      <td className="py-1.5 text-right pr-1"><EditableAmount value={row.actual} onChange={onUpdateActual} /></td>
      <td className="py-1.5 text-right">
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-base leading-none">×</button>
      </td>
    </tr>
  );
}

// ─── ExpenseTable ─────────────────────────────────────────────────────────────

function ExpenseTable({ title, rows, getActual, onAddRow, onUpdateLabel, onUpdateBudget, onUpdateActual, onUpdateBucket, onDeleteRow }: {
  title: string;
  rows: BudgetExpenseRow[];
  getActual: (row: BudgetExpenseRow) => number;
  onAddRow: () => void;
  onUpdateLabel: (id: string, v: string) => void;
  onUpdateBudget: (id: string, v: number) => void;
  onUpdateActual: (id: string, v: number | null) => void;
  onUpdateBucket: (id: string, v: "spending" | "savings" | "investments") => void;
  onDeleteRow: (id: string) => void;
}) {
  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + getActual(r), 0);
  return (
    <div className="bg-[#1e1e1e] rounded-2xl border border-[#2e2e2e] p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-200">{title}</h2>
        <button onClick={onAddRow} className="text-xs text-blue-400 hover:text-blue-300 font-medium">+ Add row</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs font-medium text-gray-500 border-b border-[#2a2a2a]">
            <th className="text-left pb-2">Category</th>
            <th className="text-right pb-2 pr-1">Budget</th>
            <th className="text-right pb-2 pr-1">Actual</th>
            <th className="pb-2 w-5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <ExpenseRow
              key={row.id}
              row={row}
              displayActual={getActual(row)}
              onUpdateLabel={v => onUpdateLabel(row.id, v)}
              onUpdateBudget={v => onUpdateBudget(row.id, v)}
              onUpdateActual={v => onUpdateActual(row.id, v)}
              onUpdateBucket={v => onUpdateBucket(row.id, v)}
              onClearActual={() => onUpdateActual(row.id, null)}
              onDelete={() => onDeleteRow(row.id)}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="text-xs font-semibold text-gray-300 border-t border-[#2a2a2a]">
            <td className="pt-2">Total</td>
            <td className="text-right pt-2 pr-1 tabular-nums">{fmt(totalBudget)}</td>
            <td className="text-right pt-2 pr-1 tabular-nums">{fmt(totalActual)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ExpenseRow({ row, displayActual, onUpdateLabel, onUpdateBudget, onUpdateActual, onUpdateBucket, onClearActual, onDelete }: {
  row: BudgetExpenseRow;
  displayActual: number;
  onUpdateLabel: (v: string) => void;
  onUpdateBudget: (v: number) => void;
  onUpdateActual: (v: number) => void;
  onUpdateBucket: (v: "spending" | "savings" | "investments") => void;
  onClearActual: () => void;
  onDelete: () => void;
}) {
  const isDerived = row.actual === null;
  const actualColor = row.budget === 0 && displayActual === 0
    ? "text-gray-400"
    : displayActual < row.budget
    ? "text-green-400"
    : displayActual === row.budget
    ? "text-gray-200"
    : "text-red-400";
  return (
    <tr className="group border-b border-[#2a2a2a] hover:bg-[#252525]">
      <td className="py-1.5 pr-2"><EditableText value={row.label} onChange={onUpdateLabel} /></td>
      <td className="py-1.5 text-right pr-1"><EditableAmount value={row.budget} onChange={onUpdateBudget} /></td>
      <td className="py-1.5 text-right pr-1">
        <div className="flex items-center justify-end gap-1">
          <EditableAmount value={displayActual} onChange={onUpdateActual} dim={isDerived} colorClass={actualColor} />
          {!isDerived && (
            <button onClick={onClearActual} title="Reset to auto-derived" className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-400 text-xs transition-all">↺</button>
          )}
        </div>
      </td>
      <td className="py-1.5 pr-1">
        <select
          value={row.bucket ?? "spending"}
          onChange={e => onUpdateBucket(e.target.value as "spending" | "savings" | "investments")}
          className="w-24 border border-[#333] rounded-lg px-2 py-1 text-xs bg-[#252525] text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="spending">Spending</option>
          <option value="savings">Savings</option>
          <option value="investments">Investments</option>
        </select>
      </td>
      <td className="py-1.5 text-right">
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-base leading-none">×</button>
      </td>
    </tr>
  );
}

// ─── Top10Table ───────────────────────────────────────────────────────────────

function Top10Table({ title, logs }: { title: string; logs: BudgetExpenseLog[] }) {
  if (logs.length === 0) return null;
  return (
    <div className="bg-[#1e1e1e] rounded-2xl border border-[#2e2e2e] p-5">
      <h2 className="text-sm font-semibold text-gray-200 mb-3">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs font-medium text-gray-500 border-b border-[#2a2a2a]">
            <th className="text-left pb-2 pr-3">Vendor</th>
            <th className="text-left pb-2 pr-3">Category</th>
            <th className="text-right pb-2 pr-3">Amount</th>
            <th className="text-left pb-2">Card</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id} className="border-b border-gray-50">
              <td className="py-1.5 pr-3 text-xs text-gray-200 max-w-28 truncate">{l.vendor}</td>
              <td className="py-1.5 pr-3 text-xs text-gray-400">{l.category}</td>
              <td className="py-1.5 pr-3 text-right text-xs font-medium text-gray-800 tabular-nums">{fmt(l.amount)}</td>
              <td className="py-1.5 text-xs text-gray-400 whitespace-nowrap">{l.card}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── LogRow ───────────────────────────────────────────────────────────────────

function LogRow({ log, onUpdate, onDelete }: {
  log: BudgetExpenseLog;
  onUpdate: (patch: Partial<BudgetExpenseLog>) => void;
  onDelete: () => void;
}) {
  return (
    <tr className="group border-b border-[#2a2a2a] hover:bg-[#252525]">
      <td className="py-1.5 pr-4 text-xs text-gray-500 whitespace-nowrap">
        <input
          type="date"
          value={log.date}
          onChange={e => onUpdate({ date: e.target.value })}
          className="w-32 border border-transparent rounded px-1 py-0.5 text-xs bg-transparent text-gray-200 hover:border-[#333] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </td>
      <td className="py-1.5 pr-4 text-xs text-gray-700 max-w-40 truncate">
        <EditableText value={log.vendor} onChange={vendor => onUpdate({ vendor })} />
      </td>
      <td className="py-1.5 pr-4 text-xs text-gray-500">
        <select
          value={log.category}
          onChange={e => onUpdate({ category: e.target.value })}
          className="w-36 border border-[#333] rounded-lg px-2 py-1 text-xs bg-[#252525] text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </td>
      <td className="py-1.5 pr-4 text-right text-xs font-medium text-gray-800 tabular-nums whitespace-nowrap">
        <EditableAmount value={log.amount} onChange={amount => onUpdate({ amount: Math.abs(amount) })} />
      </td>
      <td className="py-1.5 pr-4 text-right text-xs tabular-nums whitespace-nowrap">
        <EditableAmount
          value={log.owed ?? 0}
          onChange={v => onUpdate({ owed: v > 0 ? v : undefined })}
          dim={!log.owed}
          placeholder="—"
        />
      </td>
      <td className="py-1.5 pr-4 text-xs text-gray-400 whitespace-nowrap">
        <select
          value={log.card}
          onChange={e => onUpdate({ card: e.target.value, points: defaultPoints(log.category, e.target.value) })}
          className="w-36 border border-[#333] rounded-lg px-2 py-1 text-xs bg-[#252525] text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[...new Set([...CARDS, log.card])].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="py-1.5 pr-4 text-right text-xs tabular-nums whitespace-nowrap">
        {NO_POINTS_CATS.has(log.category) ? (
          <span className="text-gray-300 text-xs">—</span>
        ) : (
          <select
            value={log.points ?? defaultPoints(log.category, log.card)}
            onChange={e => onUpdate({ points: Number(e.target.value) })}
            className="w-14 border border-gray-200 rounded px-1 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700"
          >
            {pointsOptions(log.card).map(n => <option key={n} value={n}>{n}×</option>)}
          </select>
        )}
      </td>
      <td className="py-1.5 text-right">
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-base leading-none">×</button>
      </td>
    </tr>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

// ─── EditableText ─────────────────────────────────────────────────────────────

function EditableText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing) {
    return (
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { if (draft.trim()) onChange(draft.trim()); setEditing(false); }}
        onKeyDown={e => {
          if (e.key === "Enter") { if (draft.trim()) onChange(draft.trim()); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
        className="w-full border-b border-blue-500 focus:outline-none text-xs bg-transparent py-0.5 text-white"
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className="cursor-pointer text-xs text-gray-300 hover:text-blue-400 transition-colors"
    >
      {value}
    </span>
  );
}

// ─── EditableAmount ───────────────────────────────────────────────────────────

function EditableAmount({ value, onChange, dim = false, placeholder, colorClass }: {
  value: number;
  onChange: (v: number) => void;
  dim?: boolean;
  placeholder?: string;
  colorClass?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function save() {
    const v = parseFloat(draft);
    if (!isNaN(v)) onChange(v);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="number"
        step="any"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        autoFocus
        className="w-20 text-right border-b border-blue-500 focus:outline-none text-xs bg-transparent text-white py-0.5 tabular-nums"
      />
    );
  }
  return (
    <span
      onClick={() => { setDraft(value === 0 ? "" : String(value)); setEditing(true); }}
      className={`cursor-pointer text-xs tabular-nums rounded px-1 py-0.5 hover:bg-[#2a2a2a] transition-colors ${dim ? "text-gray-600 italic" : colorClass ?? "text-gray-200"}`}
    >
      {value === 0 && placeholder ? placeholder : fmt(value)}
    </span>
  );
}
