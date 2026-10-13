// src/lib/db.ts
// Thin fetch wrapper around our /api/data/* endpoints.
// Falls back to localStorage on network error so the app still works offline.

import type { CycleGoal, CycleGoalEntry, CycleTactic, CycleWeekItem, JobPosting, JobUpdate, Movie, NewJob, NycEvent, NycEventStatus } from "./types";

const json = (res: Response) => res.json();

const api = {
  get: (path: string) => fetch(path).then(json),
  post: (path: string, body: unknown) => fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json),
  patch: (path: string, body: unknown) => fetch(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json),
  put: (path: string, body: unknown) => fetch(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json),
  delete: (path: string, body: unknown) => fetch(path, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(json),
};

export const db = {
  focusPoints: {
    list: () => api.get("/api/data/focus-points"),
    upsert: (fp: unknown) => api.post("/api/data/focus-points", fp),
    update: (id: string, updates: unknown) => api.patch("/api/data/focus-points", { id, ...updates as object }),
    delete: (id: string) => api.delete("/api/data/focus-points", { id }),
  },
  goals: {
    list: () => api.get("/api/data/goals"),
    upsert: (goal: unknown) => api.post("/api/data/goals", goal),
    update: (id: string, updates: unknown) => api.patch("/api/data/goals", { id, ...updates as object }),
    delete: (id: string) => api.delete("/api/data/goals", { id }),
  },
  habits: {
    list: () => api.get("/api/data/habits"),
    upsert: (habit: unknown) => api.post("/api/data/habits", habit),
    delete: (id: string) => api.delete("/api/data/habits", { id }),
  },
  planned: {
    list: () => api.get("/api/data/planned"),
    upsert: (plan: unknown) => api.post("/api/data/planned", plan),
    update: (id: string, updates: unknown) => api.patch("/api/data/planned", { id, ...updates as object }),
    delete: (id: string) => api.delete("/api/data/planned", { id }),
  },
  events: {
    list: () => api.get("/api/data/events"),
    upsert: (event: unknown) => api.post("/api/data/events", event),
    delete: (id: string) => api.delete("/api/data/events", { id }),
  },
  notes: {
    get: () => api.get("/api/data/notes"),
    save: (content: string) => api.put("/api/data/notes", { content }),
  },
  budget: {
    get: (month: string) => api.get(`/api/data/budget?month=${month}`),
    save: (month: string, data: unknown) => api.put(`/api/data/budget?month=${month}`, data),
  },
  summary: {
    list: () => api.get("/api/data/summary"),
    upsert: (month: string, category: string, value: number) => api.post("/api/data/summary", { month, category, value }),
  },
  gcal: {
    get: () => api.get("/api/data/gcal"),
    disconnect: () => api.delete("/api/data/gcal", {}),
  },
  exercises: {
    list: () => api.get("/api/data/exercises"),
    upsert: (exercise: unknown) => api.post("/api/data/exercises", exercise),
  },
  sessions: {
    list: () => api.get("/api/data/sessions"),
    upsert: (session: unknown) => api.post("/api/data/sessions", session),
    delete: (id: string) => api.delete("/api/data/sessions", { id }),
  },
  sets: {
    upsert: (set: unknown) => api.post("/api/data/sets", set),
    delete: (id: string) => api.delete("/api/data/sets", { id }),
  },
  drinks: {
    list: () => api.get("/api/data/drink-log"),
    log: (date: string) => api.post("/api/data/drink-log", { date }),
    remove: (date: string) => api.delete("/api/data/drink-log", { date }),
  },
  powder: {
    list: () => api.get("/api/data/powder-log"),
    log: (date: string) => api.post("/api/data/powder-log", { date }),
    remove: (date: string) => api.delete("/api/data/powder-log", { date }),
  },
  runningCompletions: {
    list: () => api.get("/api/data/running-completions"),
    complete: (entry: unknown) => api.post("/api/data/running-completions", entry),
    uncomplete: (week: number, run_number: number) => api.delete("/api/data/running-completions", { week, run_number }),
  },
  groceryHauls: {
    list: () => api.get("/api/data/grocery-hauls"),
    add: (haul: unknown) => api.post("/api/data/grocery-hauls", haul),
    delete: (id: string) => api.delete("/api/data/grocery-hauls", { id }),
  },
  meals: {
    list: () => api.get("/api/data/meals"),
    add: (meal: unknown) => api.post("/api/data/meals", meal),
    delete: (id: string) => api.delete("/api/data/meals", { id }),
  },
  tripExpenses: {
    list: () => api.get("/api/data/trip-expenses"),
    add: (expense: unknown) => api.post("/api/data/trip-expenses", expense),
    delete: (id: string) => api.delete("/api/data/trip-expenses", { id }),
  },
  jobs: {
    list: (): Promise<JobPosting[]> => api.get("/api/data/jobs"),
    // Only whitelisted fields are writable — the scanner and DB trigger own the rest.
    update: (id: number, updates: JobUpdate): Promise<JobPosting | { error: string }> =>
      api.patch("/api/data/jobs", { id, ...updates }),
    // Returns { ok, job } or { ok: false, error } (409 = url already tracked).
    create: async (job: NewJob): Promise<{ ok: true; job: JobPosting } | { ok: false; error: string }> => {
      try {
        const res = await fetch("/api/data/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job) });
        const body = await res.json().catch(() => ({}));
        return res.ok ? { ok: true, job: body } : { ok: false, error: body.error ?? `Request failed (${res.status})` };
      } catch {
        return { ok: false, error: "Network error — try again." };
      }
    },
  },
  cycle: {
    goals: {
      list: (): Promise<CycleGoal[]> => api.get("/api/data/cycle-goals"),
      add: (goal: Omit<CycleGoal, "id">): Promise<CycleGoal> => api.post("/api/data/cycle-goals", goal),
      update: (id: string, updates: Partial<CycleGoal>): Promise<CycleGoal> => api.patch("/api/data/cycle-goals", { id, ...updates }),
      remove: (id: string) => api.delete("/api/data/cycle-goals", { id }),
    },
    tactics: {
      list: (): Promise<CycleTactic[]> => api.get("/api/data/cycle-tactics"),
      add: (tactic: Omit<CycleTactic, "id">): Promise<CycleTactic> => api.post("/api/data/cycle-tactics", tactic),
      update: (id: string, updates: Partial<CycleTactic>): Promise<CycleTactic> => api.patch("/api/data/cycle-tactics", { id, ...updates }),
      remove: (id: string) => api.delete("/api/data/cycle-tactics", { id }),
    },
    week: {
      list: (week?: string): Promise<CycleWeekItem[]> => api.get(week ? `/api/data/cycle-week?week=${week}` : "/api/data/cycle-week"),
      add: (items: Omit<CycleWeekItem, "id">[]): Promise<CycleWeekItem[]> => api.post("/api/data/cycle-week", items),
      update: (id: string, updates: Partial<CycleWeekItem>): Promise<CycleWeekItem> => api.patch("/api/data/cycle-week", { id, ...updates }),
    },
    entries: {
      list: (goalId?: string): Promise<CycleGoalEntry[]> => api.get(goalId ? `/api/data/cycle-entries?goal=${goalId}` : "/api/data/cycle-entries"),
      add: (entry: Omit<CycleGoalEntry, "id">): Promise<CycleGoalEntry> => api.post("/api/data/cycle-entries", entry),
      update: (id: string, updates: Partial<CycleGoalEntry>): Promise<CycleGoalEntry> => api.patch("/api/data/cycle-entries", { id, ...updates }),
      remove: (id: string) => api.delete("/api/data/cycle-entries", { id }),
    },
  },
  nycEvents: {
    list: (): Promise<NycEvent[]> => api.get("/api/data/nyc-events"),
    setStatus: (id: string, status: NycEventStatus): Promise<NycEvent> => api.patch("/api/data/nyc-events", { id, status }),
  },
  movies: {
    list: (): Promise<Movie[]> => api.get("/api/data/movies"),
    setPick: (id: string, pick_status: NonNullable<Movie["pick_status"]>): Promise<Movie> => api.patch("/api/data/movies", { id, pick_status }),
    markWatched: (id: string, watched_on: string): Promise<Movie> => api.patch("/api/data/movies", { id, watched: true, watched_on }),
  },
  dnd: {
    campaigns: {
      list: () => api.get("/api/data/dnd-campaigns"),
      upsert: (row: unknown) => api.post("/api/data/dnd-campaigns", row),
      delete: (id: string) => api.delete("/api/data/dnd-campaigns", { id }),
    },
    characters: {
      list: (campaign_id: string) => api.get(`/api/data/dnd-characters?campaign_id=${campaign_id}`),
      upsert: (row: unknown) => api.post("/api/data/dnd-characters", row),
      delete: (id: string) => api.delete("/api/data/dnd-characters", { id }),
    },
    locations: {
      list: (campaign_id: string) => api.get(`/api/data/dnd-locations?campaign_id=${campaign_id}`),
      upsert: (row: unknown) => api.post("/api/data/dnd-locations", row),
      delete: (id: string) => api.delete("/api/data/dnd-locations", { id }),
    },
    sessions: {
      list: (campaign_id: string) => api.get(`/api/data/dnd-sessions?campaign_id=${campaign_id}`),
      upsert: (row: unknown) => api.post("/api/data/dnd-sessions", row),
      delete: (id: string) => api.delete("/api/data/dnd-sessions", { id }),
    },
    lore: {
      list: (campaign_id: string) => api.get(`/api/data/dnd-lore?campaign_id=${campaign_id}`),
      upsert: (row: unknown) => api.post("/api/data/dnd-lore", row),
      delete: (id: string) => api.delete("/api/data/dnd-lore", { id }),
    },
    quests: {
      list: (campaign_id: string) => api.get(`/api/data/dnd-quests?campaign_id=${campaign_id}`),
      upsert: (row: unknown) => api.post("/api/data/dnd-quests", row),
      delete: (id: string) => api.delete("/api/data/dnd-quests", { id }),
    },
    concepts: {
      list: (campaign_id: string) => api.get(`/api/data/dnd-concepts?campaign_id=${campaign_id}`),
      upsert: (row: unknown) => api.post("/api/data/dnd-concepts", row),
      delete: (id: string) => api.delete("/api/data/dnd-concepts", { id }),
    },
  },
};
