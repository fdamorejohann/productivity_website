import { supabase } from "../_supabase.js";

export default async function handler(req, res) {
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
