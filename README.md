# Weekly Goals

A local-first desktop app for tracking weekly goals. Define targets, log progress any day you want, and measure weekly completion over time.

## Tech Stack

- **React 19 + TypeScript** — UI
- **Vite 8** — dev server & bundler
- **Tailwind CSS 3** — styling
- **Tauri v2** — native desktop shell
- **localStorage** — persistence (structured for easy SQLite migration)

## Getting Started

### Prerequisites

- Node.js ≥ 18
- [Rust](https://www.rust-lang.org/tools/install) (required for Tauri)
- Tauri system dependencies — [platform guide](https://v2.tauri.app/start/prerequisites/)

### Web dev server (no Tauri)

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

### Tauri desktop app

```bash
npm install
npm run tauri dev
```

This starts Vite in the background and launches the native window. The first run compiles the Rust side, which takes a few minutes.

### Production build

```bash
npm run build          # web only
npm run tauri build    # desktop bundle (.app / .dmg on macOS)
```

## Project Structure

```
src/
  App.tsx                   # Root component, all state lives here
  main.tsx                  # React entry point
  styles.css                # Tailwind base styles
  lib/
    types.ts                # Goal, PlannedTask, CompletionLog, View
    date.ts                 # startOfWeek, currentWeekKeys, toDateString, …
    scoring.ts              # getGoalProgress, getWeekScore, getMonthAverage, …
    storage.ts              # localStorage facade (swap for SQLite here)
  components/
    Sidebar.tsx             # Navigation + goal list + GoalForm trigger
    GoalForm.tsx            # Modal for creating a new goal
    GoalCard.tsx            # Single goal progress card with Log +1 button
    WeekDashboard.tsx       # Current-week overview with overall score
    WeekPlanner.tsx         # Mon–Sun drag-and-drop planner
    AnalyticsPanel.tsx      # Weekly scores, month average, per-goal history
src-tauri/                  # Tauri/Rust app shell
```

## How It Works

- **Weeks start on Monday.**
- Logging a goal creates a `CompletionLog` for today's date.
- Planned tasks (set in the Planner) are separate from completion logs — planning doesn't count as done.
- Each active goal contributes up to 100% of its weekly target to the overall score; the overall score is the average across active goals.
- Deleting a goal also removes all its plans and logs.
- All data is persisted in `localStorage` under the keys `wg_goals`, `wg_planned_tasks`, and `wg_completion_logs`.

## Migrating Storage to SQLite

All reads and writes go through `src/lib/storage.ts`. Replace the `localStorage` calls there with Tauri's `@tauri-apps/plugin-sql` (or any async store) and update the return types to `Promise<T[]>`. No other file needs to change.

## Future Improvements

- SQLite persistence via Tauri plugin for larger datasets
- Custom log amounts (e.g. log 3 instead of 1)
- Inline edit for goal name/target
- Archive goals instead of hard-delete
- Week navigation (browse past weeks on the dashboard)
- Notifications / reminders via Tauri
- Export data as CSV or JSON
- Dark mode
