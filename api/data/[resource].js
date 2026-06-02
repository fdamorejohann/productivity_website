import { supabase } from "../_supabase.js";

export default async function handler(req, res) {
  const { resource } = req.query;

  switch (resource) {
    case "focus-points": return handleFocusPoints(req, res);
    case "goals":      return handleGoals(req, res);
    case "habits":     return handleHabits(req, res);
    case "planned":    return handlePlanned(req, res);
    case "events":     return handleEvents(req, res);
    case "notes":      return handleNotes(req, res);
    case "budget":     return handleBudget(req, res);
    case "summary":    return handleSummary(req, res);
    case "gcal":       return handleGcal(req, res);
    case "exercises":  return handleExercises(req, res);
    case "sessions":   return handleSessions(req, res);
    case "sets":             return handleSets(req, res);
    case "dnd-campaigns":    return handleDndTable(req, res, "dnd_campaigns", "id");
    case "dnd-characters":   return handleDndTable(req, res, "dnd_characters", "campaign_id");
    case "dnd-locations":    return handleDndTable(req, res, "dnd_locations", "campaign_id");
    case "dnd-sessions":     return handleDndTable(req, res, "dnd_sessions", "campaign_id");
    case "dnd-lore":         return handleDndTable(req, res, "dnd_lore", "campaign_id");
    case "dnd-quests":       return handleDndTable(req, res, "dnd_quests", "campaign_id");
    case "dnd-concepts":     return handleDndTable(req, res, "dnd_concepts", "campaign_id");
    case "yt-feed":          return handleYtFeed(req, res);
    case "news":             return handleNews(req, res);
    case "site-usage":       return handleSiteUsage(req, res);
    default:                 return res.status(404).json({ error: "Not found" });
  }
}

// ─── Focus Points ─────────────────────────────────────────────────────────────
async function handleFocusPoints(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("focus_points").select("*").order("created_at");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data, error } = await supabase.from("focus_points").upsert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "PATCH") {
    const { id, ...updates } = req.body;
    const { data, error } = await supabase.from("focus_points").update(updates).eq("id", id).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase.from("focus_points").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Goals ───────────────────────────────────────────────────────────────────
async function handleGoals(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("goals").select("*").order("created_at");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data, error } = await supabase.from("goals").upsert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "PATCH") {
    const { id, ...updates } = req.body;
    const { data, error } = await supabase.from("goals").update(updates).eq("id", id).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Habits ──────────────────────────────────────────────────────────────────
async function handleHabits(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("habits").select("*");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data, error } = await supabase.from("habits").upsert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Planned ─────────────────────────────────────────────────────────────────
async function handlePlanned(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("planned_habits").select("*");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data, error } = await supabase.from("planned_habits").upsert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "PATCH") {
    const { id, ...updates } = req.body;
    const { data, error } = await supabase.from("planned_habits").update(updates).eq("id", id).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase.from("planned_habits").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Events ──────────────────────────────────────────────────────────────────
async function handleEvents(req, res) {
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

// ─── Notes ───────────────────────────────────────────────────────────────────
async function handleNotes(req, res) {
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

// ─── Budget ──────────────────────────────────────────────────────────────────
async function handleBudget(req, res) {
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: "month required" });

  if (req.method === "GET") {
    const { data, error } = await supabase.from("budget_months").select("data").eq("month", month).single();
    if (error && error.code === "PGRST116") return res.json(null);
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data.data);
  }
  if (req.method === "PUT") {
    const { error } = await supabase.from("budget_months").upsert({ month, data: req.body });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Summary ─────────────────────────────────────────────────────────────────
async function handleSummary(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("monthly_summary").select("*").order("month");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { month, category, value } = req.body;
    const { error } = await supabase.from("monthly_summary").upsert({ month, category, value });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Google Calendar ──────────────────────────────────────────────────────────
async function getValidAccessToken() {
  const { data, error } = await supabase.from("google_tokens").select("*").eq("id", 1).single();
  if (error || !data) return null;

  // Still valid
  if (Date.now() < data.expires_at - 60_000) return data.access_token;

  // Refresh
  if (!data.refresh_token) return null;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await r.json();
  if (tokens.error) return null;
  const expires_at = Date.now() + tokens.expires_in * 1000;
  await supabase.from("google_tokens").update({ access_token: tokens.access_token, expires_at }).eq("id", 1);
  return tokens.access_token;
}

async function handleGcal(req, res) {
  if (req.method === "GET") {
    const token = await getValidAccessToken();
    if (!token) return res.json({ connected: false, events: [] });

    // Start from Monday of current week so past events this week still show
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + daysToMonday);
    monday.setHours(0, 0, 0, 0);
    const now = monday.toISOString();
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const params = new URLSearchParams({
      timeMin: now,
      timeMax: future,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "30",
    });
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const events = (data.items ?? []).map(e => ({
      id: e.id,
      title: e.summary ?? "(No title)",
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      allDay: !e.start?.dateTime,
      color: e.colorId ?? null,
    }));
    return res.json({ connected: true, events });
  }
  // Create a new event in Google Calendar
  if (req.method === "POST") {
    const token = await getValidAccessToken();
    if (!token) return res.status(401).json({ error: "Not connected" });
    const { title, date, time, description } = req.body;
    // Build start/end — if time provided use dateTime, else allDay date
    let start, end;
    if (time) {
      start = { dateTime: `${date}T${time}:00`, timeZone: "America/New_York" };
      end   = { dateTime: `${date}T${time}:00`, timeZone: "America/New_York" }; // same time; Google will show as 1hr by default
    } else {
      start = { date };
      end   = { date };
    }
    const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ summary: title, description: description ?? "", start, end }),
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    return res.json({ ok: true, id: data.id });
  }
  // Delete an event from Google Calendar
  if (req.method === "DELETE") {
    const { eventId } = req.body ?? {};
    // If eventId provided, delete that specific GCal event
    if (eventId) {
      const token = await getValidAccessToken();
      if (!token) return res.status(401).json({ error: "Not connected" });
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json({ ok: true });
    }
    // Otherwise disconnect (remove stored tokens)
    await supabase.from("google_tokens").delete().eq("id", 1);
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Exercises ────────────────────────────────────────────────────────────────
async function handleExercises(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase.from("exercises").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data, error } = await supabase.from("exercises").upsert(req.body, { onConflict: "name" }).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  res.status(405).end();
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
async function handleSessions(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("workout_sessions")
      .select("*, workout_sets(*, exercises(name))")
      .order("date", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data, error } = await supabase.from("workout_sessions").upsert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    await supabase.from("workout_sets").delete().eq("session_id", id);
    const { error } = await supabase.from("workout_sessions").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── D&D (generic table handler) ─────────────────────────────────────────────
async function handleDndTable(req, res, table, filterCol) {
  if (req.method === "GET") {
    let query = supabase.from(table).select("*").order("created_at");
    const filterVal = req.query[filterCol];
    if (filterVal && filterCol !== "id") query = query.eq(filterCol, filterVal);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { data, error } = await supabase.from(table).upsert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── Sets ─────────────────────────────────────────────────────────────────────
async function handleSets(req, res) {
  if (req.method === "POST") {
    const { data, error } = await supabase.from("workout_sets").upsert(req.body).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data[0]);
  }
  if (req.method === "DELETE") {
    const { id } = req.body;
    const { error } = await supabase.from("workout_sets").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }
  res.status(405).end();
}

// ─── YouTube RSS feed proxy ────────────────────────────────────────────────────
async function handleYtFeed(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const channelId = req.query.channelId || "UCjl8BKz02KHTncEcuEzFeSw"; // Defunctxx
  try {
    const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    const xml = await r.text();
    const videos = [];
    const entries = xml.split("<entry>").slice(1);
    for (const entry of entries) {
      const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
      if (idMatch && titleMatch) {
        videos.push({
          id: idMatch[1],
          title: titleMatch[1],
          thumb: `https://i.ytimg.com/vi/${idMatch[1]}/mqdefault.jpg`,
        });
      }
    }
    res.setHeader("Cache-Control", "s-maxage=3600");
    return res.json(videos);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ─── Site Usage (Reddit tracker) ──────────────────────────────────────────────
async function handleSiteUsage(req, res) {
  if (req.method === "GET") {
    const { site } = req.query;
    let query = supabase.from("site_usage").select("*").order("date", { ascending: false }).limit(60);
    if (site) query = query.eq("site", site);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  if (req.method === "POST") {
    const { site, date, seconds, visits } = req.body;
    const { data: existing } = await supabase
      .from("site_usage").select("*").eq("site", site).eq("date", date).single();
    if (existing) {
      const { data, error } = await supabase
        .from("site_usage")
        .update({ seconds: existing.seconds + seconds, visits: existing.visits + visits })
        .eq("site", site).eq("date", date).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data[0]);
    } else {
      const { data, error } = await supabase
        .from("site_usage").insert({ site, date, seconds, visits }).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data[0]);
    }
  }
  res.status(405).end();
}

// ─── News (RSS) ───────────────────────────────────────────────────────────────
const NEWS_FEEDS = {
  tech: [
    { url: "https://techcrunch.com/feed/", source: "TechCrunch" },
    { url: "https://www.theverge.com/rss/index.xml", source: "The Verge" },
  ],
  finance: [
    { url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114", source: "CNBC" },
    { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch" },
  ],
  nyc: [
    { url: "https://gothamist.com/feed", source: "Gothamist" },
    { url: "https://nypost.com/feed/", source: "NY Post" },
  ],
};

function stripHtml(str) {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#\d+;/g,"")
    .replace(/\s+/g," ").trim();
}

function extractField(entry, tag) {
  // Try CDATA first, then plain
  const cdataMatch = entry.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, "i"));
  if (cdataMatch) return cdataMatch[1].trim();
  const plainMatch = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return plainMatch ? plainMatch[1].trim() : "";
}

function parseRssItems(xml, source) {
  const items = [];
  // Handle both <item> and <entry> (Atom)
  const raw = xml.split(/<item[\s>]|<entry[\s>]/).slice(1);
  for (const entry of raw.slice(0, 6)) {
    const title  = stripHtml(extractField(entry, "title")).slice(0, 200);
    const link   = (extractField(entry, "link") || entry.match(/href="([^"]+)"/)?.[1] || "").trim();
    const pubDate= (extractField(entry, "pubDate") || extractField(entry, "published") || extractField(entry, "updated")).trim();
    // Try content:encoded first (richer), then description, then summary
    const rawDesc = extractField(entry, "content:encoded") || extractField(entry, "description") || extractField(entry, "summary");
    const description = stripHtml(rawDesc).slice(0, 500);
    if (title && link) items.push({ title, url: link, source, published: pubDate || null, description });
  }
  return items;
}

const newsCache = {};

async function handleNews(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const topic = req.query.topic ?? "tech";
  const feeds = NEWS_FEEDS[topic];
  if (!feeds) return res.status(400).json({ error: "Unknown topic" });

  // Cache for 15 min
  const cacheKey = topic;
  if (newsCache[cacheKey] && Date.now() - newsCache[cacheKey].ts < 15 * 60 * 1000) {
    return res.json(newsCache[cacheKey].items);
  }

  const all = [];
  await Promise.all(feeds.map(async ({ url, source }) => {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      const xml = await r.text();
      all.push(...parseRssItems(xml, source));
    } catch {}
  }));

  // Sort by date, return top 8
  const sorted = all.sort((a, b) => (b.published ? new Date(b.published).getTime() : 0) - (a.published ? new Date(a.published).getTime() : 0)).slice(0, 8);
  newsCache[cacheKey] = { ts: Date.now(), items: sorted };
  res.setHeader("Cache-Control", "s-maxage=1800");
  return res.json(sorted);
}
