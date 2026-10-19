/**
 * Albums.tsx — Calm page: album picks from Claude, linked to Apple Music. Listen, then mark each
 * Liked / Meh / Disliked and say why; the reason is saved to Supabase (table albums) and the next round of
 * picks is built from it. Picks are grouped into music-type tabs (albums.category); "taste_check" albums are
 * calibration picks Claude wants heard first, shown in a strip above the tabs. Each tab also shows what's
 * been liked vs not, so the taste profile per style is visible.
 */

import { useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Album, AlbumStatus } from "../lib/types";

const REACTIONS: { status: Exclude<AlbumStatus, "new" | "skipped">; label: string; prompt: string }[] = [
  { status: "liked", label: "Liked", prompt: "What did you love? (sound, vocals, lyrics, a track…)" },
  { status: "meh", label: "Meh", prompt: "What was missing or off?" },
  { status: "disliked", label: "Disliked", prompt: "What didn't work for you?" },
];
/** Tab order + labels for album categories; unknown categories sort after these under a title-cased label. */
const CATEGORIES: { key: string; label: string; blurb: string }[] = [
  { key: "techno", label: "Melodic techno", blurb: "Melodic techno and electronic, like your top tracks" },
  { key: "indie_dance", label: "Indie dance", blurb: "New Order, Hot Chip, LCD territory" },
  { key: "funk_soul", label: "Funk & soul", blurb: "Disco, funk and soul grooves" },
  { key: "dream_pop", label: "Dream pop", blurb: "Dream pop and shoegaze" },
  { key: "songwriters", label: "Songwriters", blurb: "Indie and sad-boy songwriters" },
  { key: "country", label: "Country", blurb: "Country and Americana, for Cowboy cool" },
  { key: "hiphop", label: "Hip-hop", blurb: "From Kendrick to jazz-rap" },
  { key: "psych_70s", label: "Psych & city pop", blurb: "70s, psych and Japanese city pop" },
  { key: "jazz_night", label: "Jazz & late night", blurb: "Murakami late-night jazz and dinner music" },
  { key: "soundtracks", label: "Soundtracks", blurb: "Film and game scores" },
  { key: "canon", label: "Greatest of all time", blurb: "The must-know albums" },
  { key: "deeper", label: "Go deeper", blurb: "Artists you know a few songs by; now the full album" },
];
const TASTE = "taste_check";
const ALL = "all";
const TAB_KEY = "albums.tab";
const catLabel = (key: string) =>
  CATEGORIES.find(c => c.key === key)?.label ?? (key === "other" ? "Other" : key.replace(/_/g, " ").replace(/^\w/, ch => ch.toUpperCase()));
const catOrder = (key: string) => { const i = CATEGORIES.findIndex(c => c.key === key); return i === -1 ? CATEGORIES.length + (key === "other" ? 1 : 0) : i; };
const catOf = (a: Album) => a.category ?? "other";

const LABEL: Record<AlbumStatus, string> = { new: "New", liked: "Liked", meh: "Meh", disliked: "Disliked", skipped: "Skipped" };

const readTab = () => { try { return localStorage.getItem(TAB_KEY) ?? ALL; } catch { return ALL; } };

export default function Albums() {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [open, setOpen] = useState<{ id: string; status: AlbumStatus } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [tab, setTabState] = useState<string>(readTab);

  useEffect(() => {
    db.albums.list().then(a => setAlbums(Array.isArray(a) ? a : [])).catch(() => setAlbums([]));
  }, []);

  const setTab = (t: string) => {
    setTabState(t);
    setShowDone(false);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* per-viewer convenience only */ }
  };

  const startReact = (a: Album, status: AlbumStatus) => {
    setOpen({ id: a.id, status });
    setNote(a.feedback ?? "");
  };

  const save = async (a: Album, status: AlbumStatus, feedback: string) => {
    setSaving(true);
    try {
      const updated = await db.albums.react(a.id, status, feedback);
      setAlbums(as => as?.map(x => x.id === a.id ? { ...x, ...updated } : x) ?? null);
      setOpen(null);
    } catch { /* keep the form open so nothing typed is lost */ }
    setSaving(false);
  };

  if (albums === null) return <p className="mt-12 text-[13px] text-[#5f5e5a]">Loading albums…</p>;

  const tasteQueue = albums.filter(a => catOf(a) === TASTE && a.status === "new");
  const keys = [...new Set(albums.map(catOf).filter(k => k !== TASTE))].sort((x, y) => catOrder(x) - catOrder(y));
  const activeTab = tab === ALL || keys.includes(tab) ? tab : ALL;
  const inTab = albums.filter(a => catOf(a) !== TASTE && (activeTab === ALL || catOf(a) === activeTab));
  const queue = inTab.filter(a => a.status === "new").sort((x, y) => catOrder(catOf(x)) - catOrder(catOf(y)));
  // Rated albums for this tab; taste checks count everywhere under All.
  const rated = albums.filter(a => a.status !== "new" && (activeTab === ALL || catOf(a) === activeTab));
  const liked = rated.filter(a => a.status === "liked");
  const notForMe = rated.filter(a => a.status !== "liked");
  const queued = (k: string) => albums.filter(a => a.status === "new" && (k === ALL ? catOf(a) !== TASTE : catOf(a) === k)).length;
  const count = (s: AlbumStatus) => albums.filter(a => a.status === s).length;

  const btn = "text-xs font-medium px-3 py-1 rounded-full border transition-colors";
  const ghost = `${btn} border-[#C9C7BF] text-[#5f5e5a] hover:border-[#111] hover:text-[#111]`;
  const solid = `${btn} bg-[#111] text-[#F5F4F0] border-[#111] hover:bg-[#333]`;

  const card = (a: Album) => (
    <div key={a.id} className="border border-[#111] rounded-[22px] p-4 flex flex-col gap-3 bg-[#F5F4F0]">
      <div className="flex gap-4">
        {a.artwork_url && (
          <a href={a.apple_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <img src={a.artwork_url} alt="" loading="lazy" className="w-24 h-24 rounded-[10px] object-cover bg-[#E4E2DC]" />
          </a>
        )}
        <div className="min-w-0 flex flex-col gap-1">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[#5f5e5a]">
            {[activeTab === ALL && catOf(a) !== TASTE ? catLabel(catOf(a)) : a.genre, a.year].filter(Boolean).join(" · ") || "Album"}
          </div>
          <a href={a.apple_url} target="_blank" rel="noopener noreferrer" className="text-[17px] font-medium leading-snug tracking-[-0.02em] hover:underline underline-offset-4">
            {a.title}
          </a>
          <p className="text-[13px] text-[#5f5e5a]">{a.artist}</p>
          <a href={a.apple_url} target="_blank" rel="noopener noreferrer" className="text-[12px] underline underline-offset-4 hover:text-[#5f5e5a] w-fit">
            Open in Apple Music ↗
          </a>
        </div>
      </div>
      {a.why && <p className="text-[13px] leading-snug">{a.why}</p>}

      {open?.id === a.id ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-[#5f5e5a]">
            {LABEL[open.status]} — {REACTIONS.find(r => r.status === open.status)?.prompt}
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            autoFocus
            placeholder="A sentence or two helps most."
            className="w-full text-[13px] bg-transparent border border-[#C9C7BF] rounded-[14px] p-3 focus:outline-none focus:border-[#111]"
          />
          <div className="flex gap-2">
            <button disabled={saving} onClick={() => save(a, open.status, note)} className={solid}>{saving ? "Saving…" : "Save"}</button>
            <button disabled={saving} onClick={() => setOpen(null)} className={ghost}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {REACTIONS.map(r => (
            <button key={r.status} onClick={() => startReact(a, r.status)} className={a.status === r.status ? solid : ghost}>{r.label}</button>
          ))}
          {a.status === "new" && <button onClick={() => save(a, "skipped", "")} className={ghost}>Not for me</button>}
        </div>
      )}
      {open?.id !== a.id && a.feedback && <p className="text-[12px] text-[#5f5e5a] italic">“{a.feedback}”</p>}
    </div>
  );

  const tasteLine = (a: Album) => (
    <li key={a.id} className="text-[13px] leading-snug">
      <span className="font-medium">{a.artist}</span> <span className="text-[#5f5e5a]">— {a.title}</span>
      {a.status !== "liked" && <span className="text-[11px] uppercase tracking-[0.08em] text-[#5f5e5a]"> · {LABEL[a.status]}</span>}
      {a.feedback && <span className="block text-[12px] text-[#5f5e5a] italic">“{a.feedback}”</span>}
    </li>
  );

  const pill = (k: string, label: string) => (
    <button key={k} onClick={() => setTab(k)} className={activeTab === k ? solid : ghost}>
      {label} <span className="opacity-60">{queued(k)}</span>
    </button>
  );

  return (
    <div className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="text-xl font-medium tracking-[-0.03em]">Albums to listen to</h2>
        <span className="text-[12px] text-[#5f5e5a]">{count("liked")} liked · {count("meh")} meh · {count("disliked") + count("skipped")} not for me</span>
      </div>
      <p className="text-[13px] text-[#5f5e5a] mb-5">Tap one to open it in Apple Music. After listening, mark it and say why — that's what tunes the next picks.</p>

      {tasteQueue.length > 0 && (
        <section className="mb-8 rounded-[28px] bg-[#E4E2DC] p-4 md:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h3 className="text-[11px] uppercase tracking-[0.1em] text-[#111]">Taste check <span className="text-[#5f5e5a]">· {tasteQueue.length}</span></h3>
            <span className="text-[12px] text-[#5f5e5a]">Hear these first. Each one tests a direction, so your reaction steers the next round.</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{tasteQueue.map(card)}</div>
        </section>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        {pill(ALL, "All")}
        {keys.map(k => pill(k, catLabel(k)))}
      </div>
      {activeTab !== ALL && CATEGORIES.find(c => c.key === activeTab)?.blurb && (
        <p className="text-[13px] text-[#5f5e5a] -mt-2 mb-5">{CATEGORIES.find(c => c.key === activeTab)?.blurb}</p>
      )}

      {rated.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="border border-[#D9D7CF] rounded-[22px] p-4">
            <h3 className="text-[11px] uppercase tracking-[0.1em] text-[#111] mb-2">You liked <span className="text-[#5f5e5a]">· {liked.length}</span></h3>
            {liked.length ? <ul className="flex flex-col gap-2">{liked.map(tasteLine)}</ul> : <p className="text-[13px] text-[#5f5e5a]">Nothing yet.</p>}
          </div>
          <div className="border border-[#D9D7CF] rounded-[22px] p-4">
            <h3 className="text-[11px] uppercase tracking-[0.1em] text-[#111] mb-2">Not for you <span className="text-[#5f5e5a]">· {notForMe.length}</span></h3>
            {notForMe.length ? <ul className="flex flex-col gap-2">{notForMe.map(tasteLine)}</ul> : <p className="text-[13px] text-[#5f5e5a]">Nothing yet.</p>}
          </div>
        </div>
      )}

      {queue.length === 0 ? (
        <p className="text-[13px] text-[#5f5e5a] border border-dashed border-[#C9C7BF] rounded-[22px] p-6 mb-6">Nothing queued here. Ask Claude for the next round.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">{queue.map(card)}</div>
      )}

      {rated.length > 0 && (
        <button onClick={() => setShowDone(v => !v)} className="text-[12px] text-[#5f5e5a] hover:text-[#111]">
          {showDone ? "▾" : "▸"} Rated ({rated.length})
        </button>
      )}
      {showDone && <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">{rated.map(card)}</div>}
    </div>
  );
}
