// Personal OS — Scriptable Widget
// Paste this into a new Scriptable script, then add a Scriptable widget to your home screen.
// Set widget parameter to: https://your-vercel-domain.vercel.app
// (or hardcode BASE_URL below)

const BASE_URL = args.widgetParameter || "https://productivity-website-three.vercel.app";
const PASSWORD = "your-password-here"; // your site password

// ── Auth + fetch ─────────────────────────────────────────────────────────────
async function fetchWidget() {
  // Login to get auth cookie / confirm password (your API uses a simple password check)
  // Since your API just checks localStorage on the frontend, the /api/widget endpoint
  // needs to be either public or accept a query param password. See note below.
  const url = `${BASE_URL}/api/widget?pw=${encodeURIComponent(PASSWORD)}`;
  const req = new Request(url);
  req.timeoutInterval = 10;
  return await req.loadJSON();
}

// ── Colors ───────────────────────────────────────────────────────────────────
const BG    = new Color("#111111");
const CARD  = new Color("#1e1e1e");
const DIM   = new Color("#555555");
const WHITE = new Color("#ffffff");
const GREEN = new Color("#10b981");
const RED   = new Color("#ef4444");
const BLUE  = new Color("#3b82f6");
const AMBER = new Color("#f59e0b");

function hexColor(hex) {
  return hex ? new Color(hex) : BLUE;
}

// ── Widget builder ───────────────────────────────────────────────────────────
async function buildWidget(data) {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(14, 16, 14, 16);
  w.spacing = 10;

  // Header: date
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const header = w.addText(dateStr.toUpperCase());
  header.font = Font.boldMonospacedSystemFont(10);
  header.textColor = DIM;

  w.addSpacer(4);

  // ── Daily budget ──────────────────────────────────────────────────────────
  if (data.dailyBudget !== null && data.dailyBudget !== undefined) {
    const budgetRow = w.addStack();
    budgetRow.layoutHorizontally();
    budgetRow.centerAlignContent();

    const budgetLabel = budgetRow.addText("💸  Daily Budget  ");
    budgetLabel.font = Font.systemFont(12);
    budgetLabel.textColor = DIM;

    const sign = data.dailyBudget >= 0 ? "+" : "";
    const budgetVal = budgetRow.addText(`$${sign}${data.dailyBudget}/day`);
    budgetVal.font = Font.boldSystemFont(13);
    budgetVal.textColor = data.dailyBudget >= 0 ? GREEN : RED;
  }

  // ── Runway ────────────────────────────────────────────────────────────────
  if (data.runway) {
    const r = data.runway;
    const runwayRow = w.addStack();
    runwayRow.layoutHorizontally();
    runwayRow.centerAlignContent();

    const rl = runwayRow.addText("🏁  20k Runway  ");
    rl.font = Font.systemFont(12);
    rl.textColor = DIM;

    const rv = runwayRow.addText(`$${r.current.toLocaleString()} (${r.pct}%)`);
    rv.font = Font.boldSystemFont(13);
    rv.textColor = AMBER;

    if (r.weeksLeft) {
      const rwl = w.addText(`    ${r.weeksLeft} weeks left`);
      rwl.font = Font.systemFont(11);
      rwl.textColor = DIM;
    }
  }

  w.addSpacer(4);

  // ── Habits ────────────────────────────────────────────────────────────────
  if (data.habits && data.habits.length > 0) {
    const habitsLabel = w.addText("HABITS");
    habitsLabel.font = Font.boldMonospacedSystemFont(9);
    habitsLabel.textColor = DIM;

    const habitsRow = w.addStack();
    habitsRow.layoutHorizontally();
    habitsRow.spacing = 6;

    for (const h of data.habits) {
      const chip = habitsRow.addStack();
      chip.layoutHorizontally();
      chip.centerAlignContent();
      chip.backgroundColor = h.done ? hexColor(h.color) : CARD;
      chip.cornerRadius = 8;
      chip.setPadding(4, 8, 4, 8);

      const label = chip.addText((h.done ? "✓ " : "") + h.label);
      label.font = Font.systemFont(11);
      label.textColor = h.done ? WHITE : DIM;
    }
  }

  // ── Calendar events ───────────────────────────────────────────────────────
  if (data.events && data.events.length > 0) {
    w.addSpacer(4);
    const evLabel = w.addText("TODAY");
    evLabel.font = Font.boldMonospacedSystemFont(9);
    evLabel.textColor = DIM;

    for (const ev of data.events.slice(0, 3)) {
      const evRow = w.addStack();
      evRow.layoutHorizontally();
      evRow.spacing = 4;

      const dot = evRow.addText("•");
      dot.font = Font.systemFont(12);
      dot.textColor = BLUE;

      const evText = evRow.addText(`${ev.title}  ${ev.time}`);
      evText.font = Font.systemFont(12);
      evText.textColor = WHITE;
      evText.lineLimit = 1;
    }
  }

  return w;
}

// ── Error widget ──────────────────────────────────────────────────────────────
function errorWidget(msg) {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(14, 16, 14, 16);
  const t = w.addText("⚠ " + msg);
  t.font = Font.systemFont(12);
  t.textColor = RED;
  return w;
}

// ── Run ───────────────────────────────────────────────────────────────────────
let widget;
try {
  const data = await fetchWidget();
  if (data.error) {
    widget = errorWidget(data.error);
  } else {
    widget = await buildWidget(data);
  }
} catch (e) {
  widget = errorWidget(e.message);
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();
