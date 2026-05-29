import { supabase } from "../_supabase.js";

export default async function handler(req, res) {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: "month required" });

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("budget_months")
      .select("data")
      .eq("month", month)
      .single();
    if (error && error.code === "PGRST116") return res.json(null); // not found
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data.data);
  }

  if (req.method === "PUT") {
    const { error } = await supabase
      .from("budget_months")
      .upsert({ month, data: req.body });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
