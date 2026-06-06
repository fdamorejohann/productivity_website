// src/lib/db.ts
// Thin fetch wrapper around our /api/data/* endpoints.
// Falls back to localStorage on network error so the app still works offline.

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
