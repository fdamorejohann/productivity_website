/**
 * Albums.tsx — Calm page: album picks from Claude, linked to Apple Music. Listen, then mark each
 * Liked / Meh / Disliked and say why; the reason is saved to Supabase (table albums) and the next round of
 * picks (and the taste write-up) is built from it.
 */

import { useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Album, AlbumStatus } from "../lib/types";

const REACTIONS: { status: Exclude<AlbumStatus, "new" | "skipped">; label: string; prompt: string }[] = [
  { status: "liked", label: "Liked", prompt: "What did you love? (sound, vocals, lyrics, a track…)" },
  { status: "meh", label: "Meh", prompt: "What was missing or off?" },
  { status: "disliked", label: "Disliked", prompt: "What didn't work for you?" },
];
const LABEL: Record<AlbumStatus, string> = { new: "New", liked: "Liked", meh: "Meh", disliked: "Disliked", skipped: "Skipped" };

export default function Albums() {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [open, setOpen] = useState<{ id: string; status: AlbumStatus } | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    db.albums.list().then(a => setAlbums(Array.isArray(a) ? a : [])).catch(() => setAlbums([]));
  }, []);

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

  const queue = albums.filter(a => a.status === "new");
  const done = albums.filter(a => a.status !== "new");
  const count = (s: AlbumStatus) => albums.filter(a => a.status === s).length;

  const btn = "text-xs font-medium px-3 py-1 rounded-full border transition-colors";
  const ghost = `${btn} border-[#C9C7BF] text-[#5f5e5a] hover:border-[#111] hover:text-[#111]`;
  const solid = `${btn} bg-[#111] text-[#F5F4F0] border-[#111] hover:bg-[#333]`;

  const card = (a: Album) => (
    <div key={a.id} className="border border-[#111] rounded-[22px] p-4 flex flex-col gap-3">
      <div className="flex gap-4">
        {a.artwork_url && (
          <a href={a.apple_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <img src={a.artwork_url} alt="" loading="lazy" className="w-24 h-24 rounded-[10px] object-cover bg-[#E4E2DC]" />
          </a>
        )}
        <div className="min-w-0 flex flex-col gap-1">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[#5f5e5a]">
            {[a.genre, a.year].filter(Boolean).join(" · ") || "Album"}
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

  return (
    <div className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="text-xl font-medium tracking-[-0.03em]">Albums to listen to</h2>
        <span className="text-[12px] text-[#5f5e5a]">{count("liked")} liked · {count("meh")} meh · {count("disliked")} disliked</span>
      </div>
      <p className="text-[13px] text-[#5f5e5a] mb-5">Tap one to open it in Apple Music. After listening, mark it and say why — that's what tunes the next picks.</p>

      {queue.length === 0 ? (
        <p className="text-[13px] text-[#5f5e5a] border border-dashed border-[#C9C7BF] rounded-[22px] p-6">Nothing queued. Ask Claude for the next round.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">{queue.map(card)}</div>
      )}

      {done.length > 0 && (
        <button onClick={() => setShowDone(v => !v)} className="text-[12px] text-[#5f5e5a] hover:text-[#111]">
          {showDone ? "▾" : "▸"} Rated ({done.length})
        </button>
      )}
      {showDone && <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">{done.map(card)}</div>}
    </div>
  );
}
