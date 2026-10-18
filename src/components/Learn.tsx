/**
 * Learn.tsx — Home page "Learn" block (replaces the old reminders list): a Wikipedia article to read
 * (today's featured article, or a random one on request), an artist to listen to (rotates daily through
 * the artists in the albums table, with an Apple Music link). (The NTS Radio link lives on the Notes bubble.)
 * Wikipedia's REST API is free, keyless and CORS-enabled, so it is fetched straight from the browser.
 */

import { useEffect, useState } from "react";
import { db } from "../lib/db";
import type { Album } from "../lib/types";

interface Article { title: string; blurb: string; url: string; featured: boolean; }

const WIKI = "https://en.wikipedia.org/api/rest_v1";

function toArticle(s: { title?: string; titles?: { normalized?: string }; description?: string; extract?: string; content_urls?: { desktop?: { page?: string } } }, featured: boolean): Article | null {
  const title = s.titles?.normalized ?? s.title;
  const url = s.content_urls?.desktop?.page;
  if (!title || !url) return null;
  return { title, blurb: s.description || (s.extract ?? "").split(". ")[0], url, featured };
}

async function fetchFeatured(): Promise<Article | null> {
  const d = new Date();
  const res = await fetch(`${WIKI}/feed/featured/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`);
  if (!res.ok) return null;
  const j = await res.json();
  return j.tfa ? toArticle(j.tfa, true) : null;
}

async function fetchRandom(): Promise<Article | null> {
  const res = await fetch(`${WIKI}/page/random/summary`);
  return res.ok ? toArticle(await res.json(), false) : null;
}

/** Day number in local time, so the artist changes at local midnight. */
const dayIndex = () => { const d = new Date(); return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000); };

export default function Learn({ onOpenAlbums }: { onOpenAlbums?: () => void }) {
  const [article, setArticle] = useState<Article | null | undefined>(undefined);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    fetchFeatured().then(a => a ?? fetchRandom()).then(setArticle).catch(() => setArticle(null));
    db.albums.list().then(a => setAlbums(Array.isArray(a) ? a : [])).catch(() => setAlbums([]));
  }, []);

  const another = () => { setArticle(undefined); fetchRandom().then(setArticle).catch(() => setArticle(null)); };

  // One album per artist (the queue first, newest picks first), so the day's artist rotates through everyone.
  const artists = [...new Map(albums.filter(a => a.status !== "skipped" && a.status !== "disliked").map(a => [a.artist, a])).values()];
  const pick = artists.length ? artists[(dayIndex() + shift) % artists.length] : null;

  const link = "underline underline-offset-4 decoration-[#C9C7BF] hover:decoration-[#111] hover:text-[#111] transition-colors";
  const label = "text-[11px] uppercase tracking-[0.1em]";

  return (
    <div className="space-y-4">
      <div>
        <p className={label}>Read</p>
        {article === undefined ? <p className="mt-1">Finding something to read…</p>
          : article === null ? <p className="mt-1">Couldn't reach Wikipedia.</p>
          : (
            <p className="mt-1">
              <a href={article.url} target="_blank" rel="noopener noreferrer" className={`${link} text-[#111]`}>{article.title}</a>
              {article.blurb && <span> — {article.blurb}</span>}
              <span className="block mt-0.5 text-[12px]">
                {article.featured ? "Today's featured article · " : "Random article · "}
                <button onClick={another} className={link}>another</button>
              </span>
            </p>
          )}
      </div>

      {pick && (
        <div>
          <p className={label}>Listen</p>
          <p className="mt-1">
            <a href={pick.apple_url} target="_blank" rel="noopener noreferrer" className={`${link} text-[#111]`}>{pick.artist}</a>
            <span> — {pick.title}{pick.genre ? `, ${pick.genre}` : ""}</span>
            <span className="block mt-0.5 text-[12px]">
              <button onClick={() => setShift(s => s + 1)} className={link}>another</button>
              {onOpenAlbums && <> · <button onClick={onOpenAlbums} className={link}>all albums</button></>}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
