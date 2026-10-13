# Personal OS — CLAUDE.md

This file is the project memory. Read it at the start of every session before touching any code.

---

## What this app is

**Personal OS** is a private, password-protected personal dashboard deployed on Vercel. It started as a weekly goals tracker but has grown into a full personal operating system. It is Finn's personal app — there is no multi-user support, no sign-up flow.

Light editorial look (2026-10-12, off-white #ECEBE7 + ink #111, Inter Tight). Charts: single-series lines are ink; category charts (spend pie, budget map, workout types, easy/long runs) use the fixed validated palette #2a78d6, #eb6834, #1baf7a, #eda100, #e87ba4, #008300, #4a3aa7 in that order (pie folds past 7 into a gray "Other"); text stays ink, never series-colored; good/bad uses #006300 / #d03b3b with a check/! label. 12 Week Year (2026-10-12): cycle Q4 = Oct 5 - Dec 27 (week 13 review), config in src/lib/cycle.ts (CYCLE). Tables cycle_goals (area fitness/money/work/calm, target/progress/unit, lower_is_better, auto savings|jobs), cycle_tactics (default_day 0=Mon or null=tray, active), cycle_week_items (one per tactic per week; day null = tray, done). On load, every active tactic missing from this week gets an item (fixed days placed, others in the tray). Home shows the cycle score + reminders on the right, the goals band, and the week board (tap tray item then a day; tap a placed tactic to check it off). Goals have a mode: count (+/- on progress), list (cycle_goal_entries with title/done; open the goal to add items and check them off; no target = share of items done), measure (cycle_goal_entries with week_start/value, one per week; progress = best, or latest if use_latest), auto (savings = Finances Total, i.e. savings + investing + leftover from monthly_summary, from SAVINGS_FROM = 2026-09 (September included on purpose), skipping excluded months; jobs = pipeline; kettlebell = best session score min(1, sets/5) * min(1, 35 / (minutes scaled to 5 sets)), shown as "50 min -> 35" for 5+ sets or "4 sets · 30 min"; pullups = most reps in one set of bodyweight pull-up/chin-up exercises in lifting workouts; run = longest running distance; lsit = longest hold from L-sit workouts (cardio_data.hold_sec) or the "L-sit (seconds as reps)" exercise; yoga = weeks with a yoga workout logged or the Yoga tactic checked off). Workout-based goals count from the cycle start (Oct 5); the goal dropdown shows the best before Q4. Logged workouts also check off this week's tactics (lifting -> Gym, kettlebell -> Kettlebell, running/biking -> Cardio, yoga -> Yoga), moving the box to the day you trained. Workout types offered: lifting, running, kettlebell (sets + total time), biking, yoga, L-sit (best hold + sets); rollerblading / muay thai only display for old sessions. Home band goals open their area page; home hooks refetch when returning Home. Week board sits below the bubbles. Q4 page (#q4) = scorecard + goal and tactic editors; Calm page (#calm) = calm goals with +/- counters (Movies page folded in); Gym/Finances/Jobs pages open with their area goals (GoalStrip). Components in src/components/Cycle.tsx, hooks in src/lib/cycle.ts. Home: giant stacked greeting; a small gray column of live reminders (job follow-ups + pipeline next steps, a gym nudge when no session this week or none in 3+ days, and open to-dos from Notes written as `[ ] thing`, `- [ ] thing` or `todo: thing`); then one outlined bubble per page with a live preview line. Each bubble opens a full page; the URL hash (`#jobs`, `#money`, `#gym`, `#movies`, `#notes`) tracks the open page so refresh and Back work. Pages:
- **Jobs** — job postings found + fit-scored by the external scanner, plus manual "+ Add" rows (`job_postings`). Stage tiles with counts: New / Interested / Applied / Pipeline (screen·interview·offer) / Archive (rejected·withdrawn·skipped·closed); each job is its own rounded card. Search box searches across all tabs (id, company, title, location, next step, contact, notes, why interested; Esc clears). Category filter All / Lead / Engineer / Product next to search (remembered in localStorage `pos_jobs_category`); category badge on each row; category editable in the expanded row. Expanded row: one-click next-step buttons per stage (e.g. Interested / I applied / Skip) + full status dropdown, why interested, contact, next step, follow-up date ("Follow up" chip when due), applied date, notes
- **Finances** — BudgetPanel with a month switcher + pill tabs (remembered in localStorage `pos_budget_section`): Overview (FinanceBox savings chart, summary cards, leftover chart, daily budget, spend pie) / Budget (budget map, income + expense tables) / Expenses (add expense, expense log, CSV import)
- Removed from the dashboard (code/tables/endpoints may still exist, unused): Focus Points, Weekly Goals, Daily Tasks, Habits, Whoop, drink/powder trackers, food cost, and (2026-10-12) News, Defunct YouTube widget, Bible verse, D&D, England & Dublin trip
- **Notes** — freeform scratchpad
- **Movies** — placeholder ("coming soon"); watchlist + recommendations not built yet
- **Gym** — Workouts (WorkoutPanel) and 10K plan (RunningPanel) toggle
- D&D (DndPanel.tsx) and TripPanel.tsx still exist but aren't linked from the home page

**Architecture:**
- React + Vite frontend (TypeScript, Tailwind CSS)
- Vercel serverless API (`/api/data/[resource].js`) — single handler routes all data requests
- Supabase (Postgres) as the database — all data lives there, not in localStorage
- Password-protected via `/api/auth/login` + `localStorage.setItem("site_authed", "1")`
- The old Tauri/desktop shell and localStorage data model still exist in the codebase but are no longer the primary architecture

---

## How to run

```bash
npm install
npm run dev        # web only — http://localhost:5173
npm run build      # production build (output: dist/)
```

Production is deployed to Vercel. The API routes in `/api/` run as Vercel serverless functions.

**Environment variables required (set in Vercel dashboard):**
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_KEY` — service role key (bypasses RLS)
- `SITE_PASSWORD` — plaintext password for the lock screen

---

## File structure

```
codeProject/
├── CLAUDE.md                        ← you are here
├── README.md
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.app.json                ← strict TS, verbatimModuleSyntax enabled
│                                       (requires `import type` for type-only imports)
├── vercel.json                      ← deploy config (buildCommand, outputDirectory)
├── supabase-schema.sql              ← full DB schema — run in Supabase SQL editor
├── api/
│   ├── _supabase.js                 ← shared Supabase client (service key)
│   ├── auth/
│   │   └── login.js                ← POST /api/auth/login — checks SITE_PASSWORD
│   └── data/
│       └── [resource].js           ← single handler for ALL data endpoints (see below)
└── src/
    ├── main.tsx                     ← React root
    ├── styles.css / index.css       ← Tailwind + global styles
    ├── App.tsx                      ← Mounts LockScreen or PersonalOS based on auth
    ├── lib/
    │   ├── db.ts                    ← Thin fetch wrapper around /api/data/* endpoints
    │   ├── types.ts                 ← TypeScript types (legacy weekly-goals types live here too)
    │   ├── date.ts                  ← Date utilities
    │   ├── scoring.ts               ← Legacy weekly-goals scoring (still used by WeekDashboard)
    │   └── storage.ts               ← Legacy localStorage facade (still used by WeekDashboard)
    └── components/
        ├── LockScreen.tsx           ← Password gate — shown if not authed
        ├── PersonalOS.tsx           ← ROOT: bubble home + full-page router (Jobs, Finances, Gym, Movies, Notes)
        ├── BudgetPanel.tsx          ← Monthly budget: income/expenses/summary
        ├── WorkoutPanel.tsx         ← Exercise sessions and sets logger
        ├── DndPanel.tsx             ← D&D campaign manager
        ├── Sidebar.tsx              ← Legacy: left nav for old weekly-goals views
        ├── GoalForm.tsx             ← Legacy: create weekly-goals goal modal
        ├── GoalCard.tsx             ← Legacy: weekly-goals dashboard card
        ├── WeekDashboard.tsx        ← Legacy: weekly-goals week view
        ├── WeekPlanner.tsx          ← Legacy: weekly-goals Mon–Sun planner grid
        └── AnalyticsPanel.tsx       ← Legacy: weekly-goals bar chart analytics
```

---

## API layer

All data flows through a single Vercel serverless function: `api/data/[resource].js`.

The `db.ts` client calls these endpoints. Every resource supports a consistent pattern of GET / POST (upsert) / PATCH (update by id) / DELETE (by id), with some exceptions.

| Endpoint | Supabase table | Notes |
|---|---|---|
| `/api/data/focus-points` | `focus_points` | Focus areas that goals belong to |
| `/api/data/goals` | `goals` | Weekly/daily goals |
| `/api/data/habits` | `habits` | Habit definitions |
| `/api/data/planned` | `planned_habits` | Per-day habit completions |
| `/api/data/events` | `calendar_events` | Personal calendar events |
| `/api/data/notes` | `notes` | Single-row freeform notes |
| `/api/data/budget?month=YYYY-MM` | `budget_data` | Monthly budget JSON blob |
| `/api/data/summary` | `budget_summary` | Aggregated budget category totals |
| `/api/data/gcal` | — | Google Calendar OAuth token management |
| `/api/data/exercises` | `exercises` | Exercise definitions |
| `/api/data/sessions` | `workout_sessions` | Workout sessions |
| `/api/data/sets` | `workout_sets` | Sets within a session |
| `/api/data/jobs` | `job_postings` | GET all (fit_score desc nulls last, first_seen_at desc). POST `{ url?, company, title, location?, why_interested? }` → `source='manual'`, `status='interested'`; blank url → `manual:<slug>`; 409 if url exists. PATCH `{ id, …}` whitelist: status, category (`lead`\|`engineer`\|`product` only), notes, why_interested, contact, next_step, follow_up_on, applied_at. Never write `status_changed_at` (DB trigger). `category` comes back via `select('*')`. No DELETE |
| `/api/data/dnd-campaigns` | `dnd_campaigns` | D&D campaigns |
| `/api/data/dnd-characters` | `dnd_characters` | Characters (filtered by campaign_id) |
| `/api/data/dnd-locations` | `dnd_locations` | Locations (filtered by campaign_id) |
| `/api/data/dnd-sessions` | `dnd_sessions` | Session recaps (filtered by campaign_id) |
| `/api/data/dnd-lore` | `dnd_lore` | Lore entries (filtered by campaign_id) |
| `/api/data/dnd-quests` | `dnd_quests` | Quests (filtered by campaign_id) |
| `/api/data/dnd-concepts` | `dnd_concepts` | World concepts (filtered by campaign_id) |

The `db.ts` wrapper is the only place that calls these endpoints directly. Components call `db.*` methods, never `fetch` directly.

---

## Auth

- `LockScreen.tsx` shows on load if `localStorage.getItem("site_authed") !== "1"`
- On correct password, `/api/auth/login` returns 200 and the app sets the localStorage flag
- `App.tsx` renders either `<LockScreen onUnlock={...} />` or `<PersonalOS />` based on that flag
- No JWT, no sessions — it's a single-user app with a simple shared password

---

## Database schema

See `supabase-schema.sql` for the full schema. Key tables:

- `goals` — `id, title, type (weekly|daily), starred, done, color, created_at`
- `focus_points` — `id, title, notes, color, done, created_at`
- `habits` — `id, label, color, frequency (int, times/week target)`
- `planned_habits` — `id, habit_id, date (YYYY-MM-DD), done`
- `calendar_events` — `id, date, title, time, description, gcal_id`
- `notes` — single row `(id=1, content text)`
- `budget_data` — monthly JSON blobs
- `budget_summary` — `month, category, value`
- `exercises` — exercise definitions
- `workout_sessions` — session records
- `workout_sets` — sets within a session
- `dnd_*` tables — campaign, characters, locations, sessions, lore, quests, concepts
- `job_postings` — `id, url (unique), source ('manual' for hand-added), company, title, location, remote, salary, description, status (new|interested|applied|screen|interview|offer|rejected|withdrawn|skipped|closed), category (lead|engineer|product, check constraint; set from title on insert by trigger `job_postings_set_category` → `public.job_category(title)` when null; overridable via PATCH), status_changed_at (trigger), applied_at, why_interested, contact, next_step, follow_up_on, notes, fit_score (1–5, null = unscored), fit_summary, fit_details jsonb {reasons, red_flags, resume}, first_seen_at, …` — scanner + manual rows; RLS on, no policies (service key only)

---

## Design decisions

| Decision | Why |
|---|---|
| Single `[resource].js` handler | One file to edit for all API changes; Vercel dynamic routing handles dispatch |
| Supabase service key in API only | Never exposed to the frontend; all DB access is server-side |
| `db.ts` as the only fetch caller | Components stay clean; easy to swap the transport layer later |
| `import type` everywhere | TypeScript `verbatimModuleSyntax` is enabled |
| No external state manager | State lives in `PersonalOS.tsx`; prop drilling is acceptable at this scale |
| Password in env var, not hardcoded | Simple to rotate; no secrets in the repo |
| Legacy weekly-goals code kept | Still renders if the user navigates to those views; not actively maintained |

---

## Adding a new feature — checklist

1. Add table(s) to `supabase-schema.sql` and run in Supabase SQL editor
2. Add the endpoint case to `api/data/[resource].js`
3. Add the `db.*` methods to `src/lib/db.ts`
4. Add TypeScript types to `src/lib/types.ts`
5. Build the component in `src/components/`
6. Wire into `PersonalOS.tsx` (state + handlers + render)
7. Run `npm run build` — must pass TypeScript before deploying

---

## Known issues / future work

- [ ] No RLS (Row Level Security) on Supabase — relies entirely on the service key being server-side only
- [ ] Google Calendar sync is partially implemented (gcal endpoint exists, full OAuth flow TBD)
- [ ] D&D panel is feature-heavy — could be split into its own route
- [ ] Budget JSON blob approach won't scale well; consider a proper transactions table
- [ ] Legacy weekly-goals views (WeekDashboard, WeekPlanner, AnalyticsPanel) are not connected to Supabase
- [ ] No automated tests
- [ ] `src-tauri/` is vestigial — can be removed if the desktop app is no longer needed
