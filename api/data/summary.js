import { supabase } from "../_supabase.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("monthly_summary")
      .select("*")
      .order("month");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === "POST") {
    // body: { month, category, value }
    const { month, category, value } = req.body;
    const { error } = await supabase
      .from("monthly_summary")
      .upsert({ month, category, value });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
