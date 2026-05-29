export default function handler(req, res) {
  res.json({
    client_id: process.env.WHOOP_CLIENT_ID ? "set (" + process.env.WHOOP_CLIENT_ID.slice(0, 8) + "...)" : "MISSING",
    client_secret: process.env.WHOOP_CLIENT_SECRET ? "set" : "MISSING",
    redirect_base: process.env.WHOOP_REDIRECT_BASE || "MISSING",
    redirect_uri: `${process.env.WHOOP_REDIRECT_BASE}/api/whoop/callback`,
  });
}
