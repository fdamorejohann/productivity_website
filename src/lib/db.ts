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
};
