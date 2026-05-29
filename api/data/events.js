import { supabase } from "../_supabase.js";

export default async function handler(req, res) {
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
