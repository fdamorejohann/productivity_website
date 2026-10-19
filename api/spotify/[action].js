// api/spotify/[action].js
// Spotify connection for the Calm page music picks.
//   GET  /api/spotify/login     -> Spotify OAuth consent (one time)
//   GET  /api/spotify/callback  -> stores the refresh token in public.spotify_auth (first account only)
//   GET  /api/spotify/status    -> { connected, playlist }
//   POST /api/spotify/sync      -> adds songs from albums.liked_songs (liked picks) to the "new_songs" playlist
// Env: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, optional SPOTIFY_PLAYLIST_NAME (default new_songs).

import { supabase } from "../_supabase.js";

const BASE = "https://productivity-website-three.vercel.app";
const REDIRECT = `${BASE}/api/spotify/callback`;
const SCOPES = "playlist-read-private playlist-modify-private playlist-modify-public";
const PLAYLIST_NAME = process.env.SPOTIFY_PLAYLIST_NAME || "new_songs";
// "new_songs", "New Songs", "new-songs" all match.
const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default async function handler(req, res) {
  const { action } = req.query;
  try {
    switch (action) {
      case "login":    return login(req, res);
      case "callback": return await callback(req, res);
      case "status":   return await status(req, res);
      case "sync":     return req.method === "POST" ? await sync(req, res) : res.status(405).end();
      default:         return res.status(404).json({ error: "Not found" });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}

const basic = () => "Basic " + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");

function login(req, res) {
  const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  res.setHeader("Set-Cookie", `spotify_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  const params = new URLSearchParams({ client_id: process.env.SPOTIFY_CLIENT_ID, response_type: "code", redirect_uri: REDIRECT, scope: SCOPES, state });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
}

async function callback(req, res) {
  const { code, state, error } = req.query;
  const cookieState = /(?:^|;\s*)spotify_state=([^;]+)/.exec(req.headers.cookie || "")?.[1];
  if (error) return res.status(400).send(`Spotify said: ${error}`);
  if (!code || !state || state !== cookieState) return res.status(400).send("Bad or expired login state. Start again at /api/spotify/login.");

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basic() },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT }),
  });
  if (!tokenRes.ok) return res.status(500).send(`Token exchange failed: ${await tokenRes.text()}`);
  const tokens = await tokenRes.json();

  const me = await (await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${tokens.access_token}` } })).json();
  if (!me?.id) return res.status(500).send("Could not read the Spotify account.");

  // Only the first account to connect may ever be stored; later logins must be the same account.
  const { data: existing } = await supabase.from("spotify_auth").select("user_id").eq("id", 1).maybeSingle();
  if (existing && existing.user_id !== me.id) return res.status(403).send("A different Spotify account is already connected.");

  const { error: dbErr } = await supabase.from("spotify_auth")
    .upsert({ id: 1, user_id: me.id, refresh_token: tokens.refresh_token, updated_at: new Date().toISOString() });
  if (dbErr) return res.status(500).send(dbErr.message);
  res.setHeader("Set-Cookie", "spotify_state=; Path=/; Max-Age=0");
  res.redirect("/#calm");
}

async function accessToken() {
  const { data } = await supabase.from("spotify_auth").select("refresh_token").eq("id", 1).maybeSingle();
  if (!data) return null;
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: basic() },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: data.refresh_token }),
  });
  if (!r.ok) throw new Error(`Spotify refresh failed: ${await r.text()}`);
  const t = await r.json();
  if (t.refresh_token && t.refresh_token !== data.refresh_token) {
    await supabase.from("spotify_auth").update({ refresh_token: t.refresh_token, updated_at: new Date().toISOString() }).eq("id", 1);
  }
  return t.access_token;
}

async function api(token, path, init = {}) {
  const r = await fetch(path.startsWith("http") ? path : `https://api.spotify.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) { const e = new Error(`Spotify ${r.status} on ${path}: ${await r.text()}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}

let lastScan = { seen: 0, owned: 0 };
async function findPlaylist(token) {
  lastScan = { seen: 0, owned: 0 };
  for (let url = "/me/playlists?limit=50"; url;) {
    const page = await api(token, url);
    lastScan.seen += page.items?.length ?? 0;
    lastScan.owned += page.items?.filter(p => p?.owner?.id).length ?? 0;
    const hit = page.items?.find(p => norm(p?.name) === norm(PLAYLIST_NAME));
    if (hit) return hit;
    url = page.next;
  }
  return null;
}

/** Track URIs already in the playlist, so a song is never added twice. */
async function playlistUris(token, id) {
  const uris = new Set();
  for (let url = `/playlists/${id}/items?limit=50`; url;) {
    let page;
    try { page = await api(token, url); }
    catch (e) { if (e.status === 404 && url.includes("/items")) { url = url.replace("/items", "/tracks"); continue; } throw e; }
    for (const it of page.items || []) { const uri = (it.item || it.track)?.uri; if (uri) uris.add(uri); }
    url = page.next;
  }
  return uris;
}

async function addToPlaylist(token, id, uris) {
  for (let i = 0; i < uris.length; i += 100) {
    const body = JSON.stringify({ uris: uris.slice(i, i + 100) });
    try { await api(token, `/playlists/${id}/items`, { method: "POST", body }); }
    catch (e) { if (e.status !== 404) throw e; await api(token, `/playlists/${id}/tracks`, { method: "POST", body }); }
  }
}

/** Split Finn's free-text "songs I liked" into song names. */
const parseSongs = text => (text || "").split(/[\n,;]+/).map(s => s.replace(/^[\s\-•*"“']+|[\s"”']+$/g, "")).filter(Boolean);
const clean = s => s.replace(/"/g, "");

async function findTrack(token, artist, song) {
  for (const q of [`track:"${clean(song)}" artist:"${clean(artist)}"`, `${song} ${artist}`]) {
    const r = await api(token, `/search?${new URLSearchParams({ q, type: "track", limit: "5" })}`);
    const items = r.tracks?.items || [];
    const a = artist.toLowerCase();
    const best = items.find(t => t.artists?.some(x => a.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(a))) || (q.startsWith("track:") ? items[0] : null);
    if (best) return best;
  }
  return null;
}

async function status(req, res) {
  const token = await accessToken();
  if (!token) return res.json({ connected: false, playlist: null });
  const pl = await findPlaylist(token);
  return res.json({ connected: true, playlist: pl ? pl.name : null, playlistsSeen: lastScan.seen });
}

async function sync(req, res) {
  const token = await accessToken();
  if (!token) return res.status(409).json({ error: "Spotify not connected. Visit /api/spotify/login." });
  const pl = await findPlaylist(token);
  if (!pl) return res.status(404).json({ error: `No playlist named ${PLAYLIST_NAME} on this account.` });

  const { data: rows, error } = await supabase.from("albums").select("id, artist, liked_songs, songs_added").eq("status", "liked").not("liked_songs", "is", null);
  if (error) return res.status(500).json({ error: error.message });

  const existing = await playlistUris(token, pl.id);
  const added = [], skipped = [], notFound = [], toAdd = [], updates = [];
  for (const row of rows) {
    const done = new Set((row.songs_added || []).map(s => s.toLowerCase()));
    const fresh = parseSongs(row.liked_songs).filter(s => !done.has(s.toLowerCase()));
    if (!fresh.length) continue;
    const nowDone = [...(row.songs_added || [])];
    for (const song of fresh) {
      const t = await findTrack(token, row.artist, song);
      if (!t) { notFound.push({ artist: row.artist, song }); continue; }
      const label = { artist: row.artist, song, track: t.name, by: t.artists.map(x => x.name).join(", ") };
      if (existing.has(t.uri)) skipped.push(label);
      else { existing.add(t.uri); toAdd.push(t.uri); added.push(label); }
      nowDone.push(song);
    }
    updates.push({ id: row.id, songs_added: nowDone });
  }
  // Add first, then mark rows, so a failed add is retried next run.
  if (toAdd.length) await addToPlaylist(token, pl.id, toAdd);
  const now = new Date().toISOString();
  for (const u of updates) await supabase.from("albums").update({ songs_added: u.songs_added, songs_synced_at: now }).eq("id", u.id);
  return res.json({ playlist: pl.name, added, alreadyInPlaylist: skipped, notFound });
}
