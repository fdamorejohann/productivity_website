// Personal OS — Add Item (Budget or Goal)
const BASE_URL = "https://productivity-website-three.vercel.app";
const PASSWORD = "Pokeman101!";

const CATEGORIES = ["Groceries", "Food and drink", "Ubers", "Fun", "Travel Fund", "misc", "work"];
const CARDS = ["Reserve - Chase", "Preferred- Chase", "Freedom", "BOFA", "NONE", "Other"];
const POINTS_OPTIONS = ["1", "1.5", "3", "4", "5", "8", "0"];
const GOAL_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#6b7280"];

async function ask(title, placeholder = "") {
  const alert = new Alert();
  alert.title = title;
  alert.addTextField(placeholder);
  alert.addAction("Next");
  alert.addCancelAction("Cancel");
  const idx = await alert.presentAlert();
  if (idx === -1) throw new Error("Cancelled");
  return alert.textFieldValue(0).trim();
}

async function pick(title, options) {
  const alert = new Alert();
  alert.title = title;
  for (const o of options) alert.addAction(o);
  alert.addCancelAction("Cancel");
  const idx = await alert.presentAlert();
  if (idx === -1) throw new Error("Cancelled");
  return options[idx];
}

async function addBudget() {
  const vendor   = await ask("Vendor / Description", "e.g. Whole Foods");
  const amount   = await ask("Amount ($)", "e.g. 42.50");
  const category = await pick("Category", CATEGORIES);
  const card     = await pick("Card", CARDS);
  const points   = await pick("Points Multiplier", POINTS_OPTIONS);

  const confirm = new Alert();
  confirm.title = "Add Expense?";
  confirm.message = `${vendor}\n$${amount} · ${category}\n${card} · ${points}×`;
  confirm.addAction("Add");
  confirm.addCancelAction("Cancel");
  if ((await confirm.presentAlert()) === -1) throw new Error("Cancelled");

  const url = `${BASE_URL}/api/data/budget-log?pw=${encodeURIComponent(PASSWORD)}`;
  const req = new Request(url);
  req.method = "POST";
  req.headers = { "Content-Type": "application/json" };
  req.body = JSON.stringify({ vendor, amount: parseFloat(amount), category, card, points: parseFloat(points) });
  const res = await req.loadJSON();

  if (!res.ok) throw new Error(res.error || "Unknown error");

  const done = new Alert();
  done.title = "✓ Expense Added";
  done.message = `${vendor} $${amount} → ${category}`;
  done.addAction("Done");
  await done.presentAlert();
}

async function addGoal() {
  const title   = await ask("Goal Title", "e.g. Go for a run");
  const type    = await pick("Goal Type", ["daily", "weekly"]);
  const color   = await pick("Color", GOAL_COLORS);
  const starPick = await pick("Starred?", ["⭐ Yes", "No"]);
  const starred  = starPick.includes("Yes");

  const confirm = new Alert();
  confirm.title = "Add Goal?";
  confirm.message = `"${title}"\n${type} · ${color}`;
  confirm.addAction("Add");
  confirm.addCancelAction("Cancel");
  if ((await confirm.presentAlert()) === -1) throw new Error("Cancelled");

  const url = `${BASE_URL}/api/data/goals`;
  const req = new Request(url);
  req.method = "POST";
  req.headers = { "Content-Type": "application/json" };
  req.body = JSON.stringify({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    type,
    color,
    starred,
    done: false,
    created_at: new Date().toISOString(),
  });
  const res = await req.loadJSON();

  if (res.error) throw new Error(res.error);

  const done = new Alert();
  done.title = "✓ Goal Added";
  done.message = `"${title}" added to ${type} goals`;
  done.addAction("Done");
  await done.presentAlert();
}

// ── Main ──────────────────────────────────────────────────────────────────────
try {
  const choice = await pick("What do you want to do?", ["💸 Budget Expense", "🎯 Daily/Weekly Goal", "🌐 Open Website"]);

  if (choice.includes("Budget")) {
    await addBudget();
  } else if (choice.includes("Goal")) {
    await addGoal();
  } else {
    Safari.open("https://productivity-website-three.vercel.app");
  }
} catch (e) {
  if (e.message !== "Cancelled") {
    const err = new Alert();
    err.title = "Error";
    err.message = e.message;
    err.addAction("OK");
    await err.presentAlert();
  }
}

Script.complete();
