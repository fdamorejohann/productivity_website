// api/whoop/callback.js
// WHOOP redirects here after login. We exchange the code for tokens
// and store them in cookies so the frontend can call /api/whoop/data.

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Missing code");
  }

  try {
    const tokenRes = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
        redirect_uri: `${process.env.WHOOP_REDIRECT_BASE}/api/whoop/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Token exchange failed:", err);
      return res.status(500).send("Token exchange failed");
    }

    const tokens = await tokenRes.json();

    // Store tokens in httpOnly cookies (safe from JS on the page)
    const cookieOpts = "Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000";
    res.setHeader("Set-Cookie", [
      `whoop_access=${tokens.access_token}; ${cookieOpts}`,
      `whoop_refresh=${tokens.refresh_token}; ${cookieOpts}`,
    ]);

    // Redirect back to the dashboard
    res.redirect("/");
  } catch (e) {
    console.error(e);
    res.status(500).send("Server error");
  }
}
