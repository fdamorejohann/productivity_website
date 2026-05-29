import { supabase } from "../_supabase.js";

export default async function handler(req, res) {
  const { resource } = req.query;

  switch (resource) {
    case "goals":      return handleGoals(req, res);
    case "habits":     return handleHabits(req, res);
    case "planned":    return handlePlanned(req, res);
    case "events":     return handleEvents(req, res);
    case "notes":      return handleNotes(req, res);
    case "budget":     return handleBudget(req, res);
    case "summary":    return handleSummary(req, res);
    default:           return res.status(404).json({ error: "Not found" });
  }
}

// ─── Goals ───────────────────────────────────────────────────────────────────
async function handleGoals(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("goals").select("*").order("created_at");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data, error } = await supabase.from("goals").upsert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "PATCH") {
    const { id, ...updates } = req.body;
    const { data, error } = await supabase.from("goals").update(updates).eq("id", id).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Habits ──────────────────────────────────────────────────────────────────
async function handleHabits(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("habits").select("*");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data, error } = await supabase.from("habits").upsert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Planned ─────────────────────────────────────────────────────────────────
async function handlePlanned(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("planned_habits").select("*");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data, error } = await supabase.from("planned_habits").upsert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "PATCH") {
    const { id, ...updates } = req.body;
    const { data, error } = await supabase.from("planned_habits").update(updates).eq("id", id).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase.from("planned_habits").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Events ──────────────────────────────────────────────────────────────────
async function handleEvents(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("calendar_events").select("*").order("date");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data, error } = await supabase.from("calendar_events").upsert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Notes ───────────────────────────────────────────────────────────────────
async function handleNotes(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("notes").select("content").eq("id", 1).single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ content: data.content });
  }
  if (req.method === "PUT") {
    const { content } = req.body;
    const { error } = await supabase.from("notes").update({ content }).eq("id", 1);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Budget ──────────────────────────────────────────────────────────────────
async function handleBudget(req, res) {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: "month required" });

  if (req.method === "GET") {
    const { data, error } = await supabase.from("budget_months").select("data").eq("month", month).single();
    if (error && error.code === "PGRST116") return res.json(null);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data.data);
  }
  if (req.method === "PUT") {
    const { error } = await supabase.from("budget_months").upsert({ month, data: req.body });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Summary ─────────────────────────────────────────────────────────────────
async function handleSummary(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("monthly_summary").select("*").order("month");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { month, category, value } = req.body;
    const { error } = await supabase.from("monthly_summary").upsert({ month, category, value });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}
