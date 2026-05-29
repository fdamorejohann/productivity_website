// api/whoop/data.js
// Fetches today's recovery, sleep, and cycle data from WHOOP.
// Silently refreshes the access token if it has expired.

async function refreshAccessToken(refreshToken) {
  const res = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error("Refresh failed");
  return res.json();
}

function parseCookies(req) {
  const cookies = {};
  (req.headers.cookie || "").split(";").forEach((c) => {
    const [k, ...v] = c.trim().split("=");
    cookies[k] = v.join("=");
  });
  return cookies;
}

async function whoopGet(path, accessToken) {
  const res = await fetch(`https://api.prod.whoop.com/developer${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { status: res.status, data: res.ok ? await res.json() : null };
}

export default async function handler(req, res) {
  const cookies = parseCookies(req);
  let access = cookies.whoop_access;
  const refresh = cookies.whoop_refresh;

  if (!refresh) {
    return res.status(401).json({ error: "not_connected" });
  }

  // Try a quick profile call to check if access token is still valid
  let test = await whoopGet("/v2/user/profile/basic", access);

  if (test.status === 401) {
    // Token expired — refresh silently
    try {
      const tokens = await refreshAccessToken(refresh);
      access = tokens.access_token;
      const cookieOpts = "Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000";
      res.setHeader("Set-Cookie", [
        `whoop_access=${tokens.access_token}; ${cookieOpts}`,
        `whoop_refresh=${tokens.refresh_token}; ${cookieOpts}`,
      ]);
      test = await whoopGet("/v2/user/profile/basic", access);
    } catch {
      return res.status(401).json({ error: "not_connected" });
    }
  }

  // Fetch latest recovery (limit 1)
  const [recoveryRes, sleepRes, cycleRes] = await Promise.all([
    whoopGet("/v2/recovery?limit=1", access),
    whoopGet("/v2/activity/sleep?limit=1", access),
    whoopGet("/v2/cycle?limit=1", access),
  ]);

  const recovery = recoveryRes.data?.records?.[0] ?? null;
  const sleep = sleepRes.data?.records?.[0] ?? null;
  const cycle = cycleRes.data?.records?.[0] ?? null;

  res.json({
    profile: test.data,
    recovery: recovery?.score ?? null,
    sleep: sleep?.score ?? null,
    strain: cycle?.score ?? null,
  });
}
