import { supabase } from "../_supabase.js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NODE_ENV === "production"
  ? "https://productivity-website-three.vercel.app/api/auth/callback"
  : "http://localhost:3000/api/auth/callback";

export default async function handler(req, res) {
  const { action } = req.query;
  if (action === "google")   return handleGoogleRedirect(req, res);
  if (action === "callback") return handleCallback(req, res);
  return res.status(404).json({ error: "Not found" });
}

// ─── Step 1: Redirect to Google ──────────────────────────────────────────────
function handleGoogleRedirect(_req, res) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

// ─── Step 2: Exchange code for tokens ────────────────────────────────────────
async function handleCallback(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: "Missing code" });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (tokens.error) return res.status(400).json({ error: tokens.error_description });

  const expires_at = Date.now() + tokens.expires_in * 1000;

  await supabase.from("google_tokens").upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at,
  });

  // Redirect back to homepage
  const origin = process.env.NODE_ENV === "production"
    ? "https://productivity-website-three.vercel.app"
    : "http://localhost:3000";
  res.redirect(`${origin}/?gcal=connected`);
}
