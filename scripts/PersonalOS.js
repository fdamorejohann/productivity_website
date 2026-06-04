// Personal OS — Scriptable Widget (Medium, 2-column)
const BASE_URL = args.widgetParameter || "https://productivity-website-three.vercel.app";
const PASSWORD = "Pokeman101!";

async function fetchWidget() {
  const url = `${BASE_URL}/api/data/widget?pw=${encodeURIComponent(PASSWORD)}`;
  const req = new Request(url);
  req.timeoutInterval = 10;
  return await req.loadJSON();
}

const BG    = new Color("#111111");
const CARD  = new Color("#1e1e1e");
const DIM   = new Color("#555555");
const WHITE = new Color("#ffffff");
const GREEN = new Color("#10b981");
const RED   = new Color("#ef4444");
const BLUE  = new Color("#3b82f6");
const AMBER = new Color("#f59e0b");

function hexColor(hex) { return hex ? new Color(hex) : BLUE; }

async function buildWidget(data) {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(14, 16, 14, 16);

  // ── Date header ──────────────────────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const header = w.addText(dateStr.toUpperCase());
  header.font = Font.boldMonospacedSystemFont(9);
  header.textColor = DIM;

  w.addSpacer(8);

  // ── 2-column body ─────────────────────────────────────────────────────────
  const body = w.addStack();
  body.layoutHorizontally();
  body.spacing = 12;

  // ── LEFT COLUMN ──────────────────────────────────────────────────────────
  const left = body.addStack();
  left.layoutVertically();
  left.spacing = 6;

  // Budget
  if (data.dailyBudget !== null && data.dailyBudget !== undefined) {
    const sign = data.dailyBudget >= 0 ? "+" : "";
    const tmrSign = (data.tomorrowBudget ?? 0) >= 0 ? "+" : "";
    const tmrStr = data.tomorrowBudget != null ? `  → $${tmrSign}${data.tomorrowBudget}` : "";
    const t = left.addText(`💸 $${sign}${data.dailyBudget}/day${tmrStr}`);
    t.font = Font.boldSystemFont(13);
    t.textColor = data.dailyBudget >= 0 ? GREEN : RED;

    if (data.monthlyLeftover !== null && data.monthlyLeftover !== undefined) {
      const monthName = new Date().toLocaleDateString("en-US", { month: "long" });
      const sub = left.addText(`$${data.monthlyLeftover.toLocaleString()} for ${monthName}`);
      sub.font = Font.systemFont(10);
      sub.textColor = DIM;
    }
  }

  // Runway
  if (data.runway) {
    const r = data.runway;
    const t = left.addText(`🏁 $${r.current.toLocaleString()} (${r.pct}%)`);
    t.font = Font.boldSystemFont(12);
    t.textColor = AMBER;
    if (r.weeksLeft) {
      const sub = left.addText(`${r.weeksLeft} weeks left`);
      sub.font = Font.systemFont(10);
      sub.textColor = DIM;
    }
  }

  left.addSpacer(4);

  // Habits
  if (data.habits && data.habits.length > 0) {
    const hl = left.addText("HABITS");
    hl.font = Font.boldMonospacedSystemFont(8);
    hl.textColor = DIM;
    for (const h of data.habits) {
      const chip = left.addStack();
      chip.layoutHorizontally();
      chip.centerAlignContent();
      chip.backgroundColor = h.done ? hexColor(h.color) : CARD;
      chip.cornerRadius = 6;
      chip.setPadding(3, 8, 3, 8);
      const label = chip.addText((h.done ? "✓ " : "") + h.label);
      label.font = Font.systemFont(11);
      label.textColor = h.done ? WHITE : DIM;
    }
  }

  // ── DIVIDER ───────────────────────────────────────────────────────────────
  const div = body.addStack();
  div.layoutVertically();
  div.backgroundColor = new Color("#2a2a2a");
  div.size = new Size(1, 0);

  // ── RIGHT COLUMN ─────────────────────────────────────────────────────────
  const right = body.addStack();
  right.layoutVertically();
  right.spacing = 5;

  // Events
  if (data.events && data.events.length > 0) {
    const el = right.addText("TODAY");
    el.font = Font.boldMonospacedSystemFont(8);
    el.textColor = DIM;
    for (const ev of data.events.slice(0, 3)) {
      const row = right.addStack();
      row.layoutHorizontally();
      row.spacing = 3;
      const dot = row.addText("•");
      dot.font = Font.systemFont(11);
      dot.textColor = BLUE;
      const t = row.addText(ev.title);
      t.font = Font.systemFont(11);
      t.textColor = WHITE;
      t.lineLimit = 1;
    }
    right.addSpacer(4);
  }

  // Daily goals
  const starredDaily = (data.dailyGoals || []).filter(g => g.starred);
  if (starredDaily.length > 0) {
    const gl = right.addText("DAILY GOALS");
    gl.font = Font.boldMonospacedSystemFont(8);
    gl.textColor = DIM;
    for (const g of starredDaily) {
      const row = right.addStack();
      row.layoutHorizontally();
      row.spacing = 4;
      const dot = row.addText("◦");
      dot.font = Font.systemFont(12);
      dot.textColor = hexColor(g.color);
      const t = row.addText(g.title);
      t.font = Font.systemFont(11);
      t.textColor = WHITE;
      t.lineLimit = 1;
    }
  }

  w.url = "scriptable:///run/AddExpense";
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
  return w;
}

function errorWidget(msg) {
  const w = new ListWidget();
  w.backgroundColor = BG;
  w.setPadding(14, 16, 14, 16);
  const t = w.addText("⚠ " + msg);
  t.font = Font.systemFont(12);
  t.textColor = RED;
  return w;
}

let widget;
try {
  const data = await fetchWidget();
  if (data.error) { widget = errorWidget(data.error); }
  else { widget = await buildWidget(data); }
} catch (e) { widget = errorWidget(e.message); }

if (config.runsInWidget) { Script.setWidget(widget); }
else { widget.presentMedium(); }
Script.complete();
