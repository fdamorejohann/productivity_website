/**
 * Movies.tsx — Calm page: Finn's Letterboxd (cocomon415) watchlist, a "tonight" pick from it, and
 * Claude's recommendations (marked Interested / Not interested; add them to the watchlist on Letterboxd).
 * A scheduled Claude task re-syncs Letterboxd into public.movies and adds new picks; the site only marks.
 * "Watched" also checks the film off on the "Watch 4 movies" goal.
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { db } from "../lib/db";
import type { Movie } from "../lib/types";

const LETTERBOXD_USER = "cocomon415";
const filmUrl = (m: Movie) => `https://letterboxd.com/film/${m.slug}/`;
const label = (m: Movie) => `${m.title}${m.year ? ` (${m.year})` : ""}`;

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Movies({ onWatched }: { onWatched?: (m: Movie) => void }) {
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [tonight, setTonight] = useState(0);

  useEffect(() => {
    db.movies.list().then(ms => setMovies(Array.isArray(ms) ? ms : [])).catch(() => setMovies([]));
  }, []);

  const patchLocal = (id: string, updates: Partial<Movie>) =>
    setMovies(ms => ms?.map(m => m.id === id ? { ...m, ...updates } : m) ?? null);

  const setPick = async (m: Movie, pick_status: NonNullable<Movie["pick_status"]>) => {
    const prev = movies;
    patchLocal(m.id, { pick_status });
    try { await db.movies.setPick(m.id, pick_status); } catch { setMovies(prev); }
  };
  const markWatched = async (m: Movie) => {
    const prev = movies;
    const watched_on = todayYmd();
    patchLocal(m.id, { watched: true, watched_on });
    try { await db.movies.markWatched(m.id, watched_on); onWatched?.(m); } catch { setMovies(prev); }
  };

  if (movies === null) return <p className="text-[13px] text-[#5f5e5a] mt-12">Loading movies…</p>;

  const watchlist = movies.filter(m => m.on_watchlist && !m.watched);
  const picks = movies.filter(m => m.source === "claude" && m.pick_status === "new" && !m.watched);
  const interested = movies.filter(m => m.source === "claude" && m.pick_status === "interested" && !m.watched && !m.on_watchlist);
  const watchedCount = movies.filter(m => m.watched).length;
  const lastSync = movies.map(m => m.synced_at).filter(Boolean).sort().at(-1);
  const pick = watchlist.length ? watchlist[tonight % watchlist.length] : null;

  const btn = "text-xs font-medium px-3 py-1 rounded-full border transition-colors";
  const solid = `${btn} bg-[#111] text-[#F5F4F0] border-[#111] hover:bg-[#333]`;
  const quiet = `${btn} border-[#C9C7BF] text-[#5f5e5a] hover:border-[#111] hover:text-[#111]`;
  const link = (m: Movie, children: ReactNode, cls = "") => (
    <a href={filmUrl(m)} target="_blank" rel="noopener noreferrer" className={`hover:underline underline-offset-4 ${cls}`}>{children}</a>
  );

  return (
    <div className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="text-xl font-medium tracking-[-0.03em]">Movies</h2>
        <a href={`https://letterboxd.com/${LETTERBOXD_USER}/`} target="_blank" rel="noopener noreferrer"
          className="text-[12px] text-[#5f5e5a] hover:text-[#111]">
          Letterboxd · {LETTERBOXD_USER} · {watchedCount} watched{lastSync ? ` · synced ${new Date(lastSync).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""} ↗
        </a>
      </div>
      <p className="text-[13px] text-[#5f5e5a] mb-5">Your watchlist and picks matched to what you've watched. Add picks you like to your watchlist on Letterboxd; it syncs back here.</p>

      {pick && (
        <div className="bg-[#111] text-[#ECEBE7] rounded-[28px] p-6 mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.1em] opacity-60">Tonight, from your watchlist</p>
            {link(pick, pick.title, "block text-3xl sm:text-4xl font-medium tracking-[-0.04em] leading-tight mt-1")}
            {pick.year && <p className="text-[13px] opacity-60 mt-1">{pick.year}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTonight(t => t + 1 + Math.floor(Math.random() * Math.max(1, watchlist.length - 1)))}
              className={`${btn} border-[#ECEBE7]/40 text-[#ECEBE7] hover:border-[#ECEBE7]`}>Shuffle</button>
            <button onClick={() => markWatched(pick)} className={`${btn} bg-[#ECEBE7] text-[#111] border-[#ECEBE7] hover:bg-white`}>✓ Watched it</button>
          </div>
        </div>
      )}

      {picks.length > 0 && (
        <>
          <h3 className="text-[11px] uppercase tracking-[0.1em] text-[#111] mb-2">Picked for you</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {picks.map(m => (
              <div key={m.id} className="border border-[#111] rounded-[22px] p-4 flex flex-col gap-2">
                {link(m, label(m), "text-[17px] font-medium tracking-[-0.02em] leading-snug")}
                {m.why && <p className="text-[13px] leading-snug">{m.why}</p>}
                <div className="flex flex-wrap gap-2 mt-1">
                  <button onClick={() => setPick(m, "interested")} className={solid}>Interested</button>
                  <button onClick={() => setPick(m, "not_interested")} className={quiet}>Not interested</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {interested.length > 0 && (
        <>
          <h3 className="text-[11px] uppercase tracking-[0.1em] text-[#111] mb-2">Interested · add on Letterboxd</h3>
          <ul className="border-t border-[#D9D7CF] mb-8">
            {interested.map(m => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-[#D9D7CF] text-[14px]">
                <span className="min-w-0">{label(m)}</span>
                <span className="flex gap-2">
                  {link(m, "Add to watchlist ↗", "text-[12px] text-[#111] font-medium")}
                  <button onClick={() => markWatched(m)} className={quiet}>✓ Watched</button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="text-[11px] uppercase tracking-[0.1em] text-[#111] mb-2">Watchlist · {watchlist.length}</h3>
      {watchlist.length === 0 ? (
        <p className="text-[13px] text-[#5f5e5a]">Your Letterboxd watchlist is empty.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 border-t border-[#D9D7CF]">
          {watchlist.map(m => (
            <li key={m.id} className="group flex items-center justify-between gap-3 py-2 border-b border-[#D9D7CF] text-[14px]">
              {link(m, <>{m.title}{m.year && <span className="text-[#5f5e5a]"> · {m.year}</span>}</>, "min-w-0 truncate")}
              <button onClick={() => markWatched(m)} className="text-[12px] text-[#5f5e5a] hover:text-[#111] opacity-60 group-hover:opacity-100 flex-shrink-0">✓ Watched</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
