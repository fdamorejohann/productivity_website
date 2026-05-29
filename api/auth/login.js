export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { password } = req.body ?? {};

  if (password === process.env.SITE_PASSWORD) {
    res.setHeader(
      "Set-Cookie",
      "site_auth=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000"
    ); // 30 days
    return res.status(200).json({ ok: true });
  }

  res.status(401).json({ ok: false });
}
