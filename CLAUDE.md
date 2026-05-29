# Weekly Goals — CLAUDE.md

This file is the project memory. Read it at the start of every session before touching any code.

---

## What this app is

**Weekly Goals** is a local-first desktop app (React + Tauri) that tracks weekly goals.
It is NOT a daily streak tracker. The core idea is: define a target for the week, log
progress on any days you want, and measure weekly completion % over time.

- No backend, no auth, no cloud sync.
- All data is stored in `localStorage` (structured for easy migration to SQLite later).
- Built as a Tauri v2 Mac app but also runs in the browser with `npm run dev`.

---

## How to run

```bash
npm install
npm run dev              # web only — open http://localhost:5173
npm run tauri dev        # native Mac app (requires Rust installed)
npm run build            # production web build
npm run tauri build      # production .app bundle
```

Rust install (if needed): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

---

## File structure

```
codeProject/
├── CLAUDE.md                    ← you are here
├── README.md                    ← user-facing setup docs
├── package.json                 ← scripts: dev, build, tauri
├── vite.config.ts               ← Vite config (default React plugin)
├── tailwind.config.js           ← Tailwind: content paths + Mac system font
├── tsconfig.app.json            ← strict TS, verbatimModuleSyntax enabled
│                                   (requires `import type` for type-only imports)
├── src-tauri/                   ← Rust/Tauri shell
│   ├── tauri.conf.json          ← app name, window size (1200×800), dev URL
│   ├── Cargo.toml               ← Rust dependencies
│   └── src/
│       ├── main.rs              ← Tauri entry (do not edit)
│       └── lib.rs               ← Tauri commands (currently empty, add IPC here)
└── src/                         ← React app
    ├── main.tsx                 ← React root, mounts <App /> into #root
    ├── styles.css               ← Tailwind directives + scrollbar styles
    ├── App.tsx                  ← ROOT: all state lives here, actions defined here
    ├── lib/
    │   ├── types.ts             ← All TypeScript types + goalUnitLabel() helper
    │   ├── date.ts              ← Date utilities (startOfWeek, currentWeekKeys, …)
    │   ├── scoring.ts           ← Score calculations (getWeekScore, getMonthAverage, …)
    │   └── storage.ts           ← localStorage facade + data migration functions
    └── components/
        ├── Sidebar.tsx          ← Left nav: view switcher + goal list + active toggle
        ├── GoalForm.tsx         ← Modal: create a new goal (frequency or cumulative)
        ├── GoalCard.tsx         ← Dashboard card: progress bar + log button
        ├── WeekDashboard.tsx    ← View: current week score + all goal cards
        ├── WeekPlanner.tsx      ← View: Mon–Sun grid, click-to-assign goals, toggle done
        └── AnalyticsPanel.tsx  ← View: week score bar chart + per-goal history
```

---

## Data model

### Goal
Stored in `localStorage` key `wg_goals`.

```ts
{
  id: string                          // crypto.randomUUID()
  name: string                        // "Workout"
  description: string                 // optional detail, "" if empty
  trackingMode: "frequency" | "cumulative"
  target: number                      // sessions/week OR total amount/week
  amountUnit: "hours"|"pages"|"dollars"|"custom"  // cumulative only
  customUnitLabel: string             // used when amountUnit === "custom"
  sessionDuration: number             // frequency only; 0 = not set
  sessionDurationUnit: "minutes"|"hours"
  color: string                       // hex, e.g. "#3b82f6"
  active: boolean                     // inactive = hidden from dashboard/planner
  createdAt: string                   // ISO date string
}
```

**Tracking modes:**
- **frequency** — log counts. "Workout 3x/week." Each log = 1 session. Optional sessionDuration is informational only (not tracked numerically).
- **cumulative** — log amounts. "Read 2 hours/week." Each log = a decimal amount. User types the amount in the dashboard log input.

### PlannedTask
Stored in `localStorage` key `wg_planned_tasks`.

```ts
{
  id: string
  goalId: string
  date: string        // YYYY-MM-DD — which day this is planned for
  amount: number      // always 1 currently (reserved for future use)
  completed: boolean  // has the user clicked it done?
  logId?: string      // ID of the CompletionLog created when this was completed
                      // used to cleanly remove the log if the user uncompletes it
}
```

**Key behavior:** `logId` is the bridge between planner state and scoring.
When a task is toggled complete, a `CompletionLog` is created and its ID stored here.
If the task is toggled back to incomplete, that specific log is removed.

### CompletionLog
Stored in `localStorage` key `wg_completion_logs`.

```ts
{
  id: string
  goalId: string
  date: string   // YYYY-MM-DD — when it was done
  value: number  // 1 for frequency/planner; decimal for cumulative dashboard logging
}
```

**This is the single source of truth for scoring.** All score calculations read only from
CompletionLogs, not from PlannedTask.completed. Planner toggles and dashboard log buttons
both write CompletionLogs — they're additive.

---

## Core behaviors

### Scoring formula
- Each active goal contributes 0–100% based on `completed / target`
- Individual goal % is capped at 100% (can log more than target, score won't exceed 100%)
- Weekly score = average of all active goal percentages (rounded integer)
- `getGoalProgress()` — progress for one goal in one week
- `getWeekScore()` — overall week score (0–100)
- `getMonthAverage()` — average of week scores in a calendar month

### Planner: click-to-assign
1. User clicks a goal chip in the palette → it gets selected (highlighted ring)
2. Day columns turn blue/clickable
3. User clicks a day column → `onAddPlan(goalId, date)` fires
4. Same goal can be added to multiple days, or the same day multiple times
5. Press Escape or click the selected goal again to deselect
6. Drag-and-drop was removed because HTML5 drag events are unreliable in WKWebView (Tauri's Mac renderer)

### Planner: toggle completion
- Each planned chip shows an empty circle (not done) or filled ✓ (done)
- Clicking a chip calls `togglePlanComplete(planId)` in App.tsx
- **Marking done:** creates a CompletionLog (value=1) and stores its ID in `plan.logId`
- **Marking undone:** deletes the specific CompletionLog by `plan.logId`, clears `logId`
- Hovering a chip reveals an × button to remove the plan entirely (also removes linked log)

### Auto-complete past tasks
- On every app mount, App.tsx checks for plans where `date < today && !completed`
- Those are silently marked complete with a new CompletionLog (value=1)
- The intent: if you planned something and the day passed, assume you did it
- This only runs once per mount, using the plans loaded from localStorage at start time

### Past-day assignment
- Adding a plan to a day before today immediately marks it complete + creates a log
- This lets users retroactively fill in what they did

### Deleting a goal
- Removes the Goal, all its PlannedTasks, and ALL CompletionLogs for that goal
- PlannedTask-linked logs are identified by `plan.logId` and removed specifically
- Dashboard-created logs are also removed via `log.goalId !== id` filter

---

## Storage migration

`storage.ts` contains migration functions that handle old data formats:
- `migrateGoal()` — converts pre-trackingMode goals (old format had a single `unit` field)
- PlannedTask inline migration — fills in `completed: false` and `logId: undefined` for old tasks

If the data schema changes again, add a new migration function here. **Do not change the
localStorage key names** — that would silently lose user data.

---

## Design decisions to remember

| Decision | Why |
|---|---|
| No drag-and-drop in Planner | WKWebView drops drag events silently; click-to-assign is reliable everywhere |
| `logId` on PlannedTask | Lets us surgically remove just the planner-created log on undo, not all logs for that day |
| Scoring reads only CompletionLogs | Single source of truth; planner completion and dashboard logging are both additive |
| `import type` everywhere | TypeScript `verbatimModuleSyntax` is enabled — type-only imports must use `import type` |
| No external state manager | App state is small and all lives in App.tsx; prop drilling is acceptable at this scale |
| Weeks start Monday | `startOfWeek()` in date.ts handles this; day=0 (Sunday) gets `diff = -6` |
| Auto-complete on mount only | Running it on every render or on a timer would be over-engineering; mount covers the "reopened next day" case |

---

## localStorage keys

| Key | Contains |
|---|---|
| `wg_goals` | `Goal[]` |
| `wg_planned_tasks` | `PlannedTask[]` |
| `wg_completion_logs` | `CompletionLog[]` |

To wipe all data during development: open browser devtools → Application → Local Storage → delete all three keys.

---

## Known issues / future work

- [ ] Planner only shows the current week — no week navigation
- [ ] Cumulative planner chips always log value=1; user can't specify amount from the planner
- [ ] No inline goal editing (name/target) — delete and recreate for now
- [ ] Deleting a goal is permanent — no archive/soft-delete yet
- [ ] Analytics bar chart has no tooltips on smaller windows
- [ ] SQLite migration not yet done (storage.ts facade is ready for it)
- [ ] No dark mode
- [ ] No export (CSV / JSON)
- [ ] Tauri `identifier` in tauri.conf.json is still `com.tauri.dev` — change before distributing

---

## Adding a new feature — checklist

1. Add/update types in `src/lib/types.ts`
2. Add migration in `src/lib/storage.ts` if the data shape changed
3. Add logic in `src/lib/scoring.ts` (if it affects scores) or a new lib file
4. Add/update the action in `App.tsx` (state + handler)
5. Pass the new prop down to the relevant component
6. Update the component
7. Run `npm run build` — must pass TypeScript before committing
