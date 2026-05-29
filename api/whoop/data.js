// api/whoop/data.js
// Fetches today's recovery, sleep, cycle, workout history from WHOOP.
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

  // Check if access token is valid
  let test = await whoopGet("/v2/user/profile/basic", access);

  if (test.status === 401) {
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

  // Fetch all data in parallel
  const [recoveryRes, sleepRes, cycleRes, workoutRes, recoveryHistoryRes, sleepHistoryRes] = await Promise.all([
    whoopGet("/v2/recovery?limit=1", access),
    whoopGet("/v2/activity/sleep?limit=1", access),
    whoopGet("/v2/cycle?limit=1", access),
    whoopGet("/v2/activity/workout?limit=5", access),
    whoopGet("/v2/recovery?limit=7", access),
    whoopGet("/v2/activity/sleep?limit=7", access),
  ]);

  const recovery = recoveryRes.data?.records?.[0] ?? null;
  const sleep = sleepRes.data?.records?.[0] ?? null;
  const cycle = cycleRes.data?.records?.[0] ?? null;
  const workouts = workoutRes.data?.records ?? [];
  const recoveryHistory = recoveryHistoryRes.data?.records ?? [];
  const sleepHistory = sleepHistoryRes.data?.records ?? [];

  res.json({
    profile: test.data,
    recovery: recovery?.score ?? null,
    sleep: sleep?.score ?? null,
    sleepStart: sleep?.start ?? null,
    sleepEnd: sleep?.end ?? null,
    strain: cycle?.score ?? null,
    workouts,
    recoveryHistory: recoveryHistory.map(r => ({
      date: r.created_at,
      score: r.score?.recovery_score ?? null,
      hrv: r.score?.hrv_rmssd_milli ?? null,
    })),
    sleepHistory: sleepHistory.filter(s => !s.nap).map(s => ({
      date: s.end,
      performance: s.score?.sleep_performance_percentage ?? null,
      hours: s.score?.stage_summary?.total_in_bed_time_milli
        ? (s.score.stage_summary.total_in_bed_time_milli / 3_600_000).toFixed(1)
        : null,
    })),
  });
}
