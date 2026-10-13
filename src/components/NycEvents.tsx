/**
 * NycEvents.tsx — Calm page: NYC shows, performances, and museum events picked every 3 days by a
 * scheduled Claude task (it reads these statuses to learn Finn's taste). Mark each one Interested /
 * Not interested; "Went" also checks it off on the "shows or museums" goal.
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { db } from "../lib/db";
import type { NycEvent, NycEventStatus } from "../lib/types";

const KIND_LABEL: Record<NycEvent["kind"], string> = {
  theater: "Theater", music: "Music", comedy: "Comedy", dance: "Dance", museum: "Museum",
  gallery: "Gallery", film: "Film", talk: "Talk", other: "Event",
};

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function when(e: NycEvent): string {
  if (e.starts_on && e.ends_on && e.ends_on !== e.starts_on) {
    return e.starts_on <= todayYmd() ? `Through ${fmtDay(e.ends_on)}` : `${fmtDay(e.starts_on)} – ${fmtDay(e.ends_on)}`;
  }
  return e.starts_on ? fmtDay(e.starts_on) : "Dates vary";
}

/** Over = its last day (or only day) is before today. */
const isOver = (e: NycEvent) => (e.ends_on ?? e.starts_on ?? "9999") < todayYmd();

export default function NycEvents({ onWent }: { onWent?: (e: NycEvent) => void }) {
  const [events, setEvents] = useState<NycEvent[] | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    db.nycEvents.list().then(es => setEvents(Array.isArray(es) ? es : [])).catch(() => setEvents([]));
  }, []);

  const mark = async (e: NycEvent, status: NycEventStatus) => {
    const prev = events;
    setEvents(es => es?.map(x => x.id === e.id ? { ...x, status } : x) ?? null);
    try {
      await db.nycEvents.setStatus(e.id, status);
      if (status === "went") onWent?.(e);
    } catch { setEvents(prev); }
  };

  if (events === null) return <p className="text-[13px] text-[#5f5e5a]">Loading NYC picks…</p>;

  const picks = events.filter(e => e.status === "new" && !isOver(e));
  const interested = events.filter(e => e.status === "interested" && !isOver(e));
  const went = events.filter(e => e.status === "went");
  const passed = events.filter(e => e.status === "not_interested").length;
  const missed = events.filter(e => (e.status === "new" || e.status === "interested") && isOver(e));

  const btn = "text-xs font-medium px-3 py-1 rounded-full border transition-colors";
  const card = (e: NycEvent, actions: ReactNode) => (
    <div key={e.id} className="border border-[#111] rounded-[22px] p-4 flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-[11px] uppercase tracking-[0.08em] text-[#5f5e5a]">
        <span>{KIND_LABEL[e.kind]}{e.price ? ` · ${e.price}` : ""}</span>
        <span className="normal-case tracking-normal">{when(e)}</span>
      </div>
      <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-[17px] font-medium leading-snug tracking-[-0.02em] hover:underline underline-offset-4">
        {e.title}
      </a>
      {(e.venue || e.neighborhood) && (
        <p className="text-[13px] text-[#5f5e5a]">{[e.venue, e.neighborhood].filter(Boolean).join(" · ")}</p>
      )}
      {e.why && <p className="text-[13px] leading-snug">{e.why}</p>}
      <div className="flex flex-wrap gap-2 mt-1">{actions}</div>
    </div>
  );

  return (
    <div className="mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="text-xl font-medium tracking-[-0.03em]">Recommended in NYC</h2>
        <span className="text-[12px] text-[#5f5e5a]">New picks every 3 days · {passed} passed · {went.length} went</span>
      </div>
      <p className="text-[13px] text-[#5f5e5a] mb-5">Shows, performances, and museum events. Your marks teach the next round what you like.</p>

      {picks.length === 0 && interested.length === 0 && (
        <p className="text-[13px] text-[#5f5e5a] border border-dashed border-[#C9C7BF] rounded-[22px] p-6">No picks right now. The next round lands within 3 days.</p>
      )}

      {picks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {picks.map(e => card(e, <>
            <button onClick={() => mark(e, "interested")} className={`${btn} bg-[#111] text-[#F5F4F0] border-[#111] hover:bg-[#333]`}>Interested</button>
            <button onClick={() => mark(e, "not_interested")} className={`${btn} border-[#C9C7BF] text-[#5f5e5a] hover:border-[#111] hover:text-[#111]`}>Not interested</button>
          </>))}
        </div>
      )}

      {interested.length > 0 && (
        <>
          <h3 className="text-[11px] uppercase tracking-[0.1em] text-[#111] mb-2">Interested</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {interested.map(e => card(e, <>
              <button onClick={() => mark(e, "went")} className={`${btn} bg-[#111] text-[#F5F4F0] border-[#111] hover:bg-[#333]`}>✓ Went</button>
              <button onClick={() => mark(e, "not_interested")} className={`${btn} border-[#C9C7BF] text-[#5f5e5a] hover:border-[#111] hover:text-[#111]`}>Not interested</button>
            </>))}
          </div>
        </>
      )}

      {(went.length > 0 || missed.length > 0) && (
        <button onClick={() => setShowPast(v => !v)} className="text-[12px] text-[#5f5e5a] hover:text-[#111]">
          {showPast ? "▾" : "▸"} Past ({went.length} went{missed.length ? `, ${missed.length} missed` : ""})
        </button>
      )}
      {showPast && (
        <ul className="mt-2 space-y-1 text-[13px]">
          {[...went, ...missed].map(e => (
            <li key={e.id} className={e.status === "went" ? "" : "text-[#5f5e5a]"}>
              {e.status === "went" ? "✓ " : ""}<a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{e.title}</a>
              <span className="text-[#5f5e5a]"> · {when(e)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
