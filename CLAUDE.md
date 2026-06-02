# Personal OS — CLAUDE.md

This file is the project memory. Read it at the start of every session before touching any code.

---

## What this app is

**Personal OS** is a private, password-protected personal dashboard deployed on Vercel. It started as a weekly goals tracker but has grown into a full personal operating system. It is Finn's personal app — there is no multi-user support, no sign-up flow.

Core panels:
- **Goals** — weekly/daily goals with focus points, starred items, done state
- **Habits** — weekly habit tracker with Mon–Sun grid
- **Calendar** — personal events + Google Calendar sync
- **Notes** — freeform scratchpad
- **Budget** — monthly income/expense tracker
- **Workout** — exercise sessions and sets logger
- **D&D** — campaign manager (characters, locations, sessions, lore, quests, concepts)

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
        ├── PersonalOS.tsx           ← ROOT dashboard: 3-column layout, all panels
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
