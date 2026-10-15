/**
 * JobsFunnel.tsx — Jobs page: Sankey of where tracked jobs ended up (from job_postings' current status).
 * Tracked → not applied (skipped / interested / not reviewed) or Applied → waiting / company engaged / rejected /
 * withdrawn, and engaged → screen / interview / offer. Only the current status is stored, so a job rejected
 * after an interview shows as plain "Rejected".
 */

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { sankey, sankeyLeft, sankeyLinkHorizontal } from "d3-sankey";
import type { SankeyLink, SankeyNode } from "d3-sankey";
import type { JobPosting } from "../lib/types";

type NodeKey =
  | "tracked" | "unreviewed" | "skipped" | "interested" | "closedNot" | "applied"
  | "waiting" | "engaged" | "rejected" | "withdrawn" | "closed" | "screen" | "interview" | "offer";

const NODE: Record<NodeKey, { label: string; color: string }> = {
  tracked:    { label: "Tracked",              color: "#111111" },
  unreviewed: { label: "Not reviewed",         color: "#898781" },
  skipped:    { label: "Skipped",              color: "#898781" },
  interested: { label: "Interested, not applied", color: "#eb6834" },
  closedNot:  { label: "Closed before applying", color: "#898781" },
  applied:    { label: "Applied",              color: "#2a78d6" },
  waiting:    { label: "Waiting",              color: "#eda100" },
  engaged:    { label: "Company engaged",      color: "#1baf7a" },
  rejected:   { label: "Rejected",             color: "#d03b3b" },
  withdrawn:  { label: "Withdrawn",            color: "#898781" },
  closed:     { label: "Closed",               color: "#898781" },
  screen:     { label: "Screening",            color: "#1baf7a" },
  interview:  { label: "Interviewing",         color: "#1baf7a" },
  offer:      { label: "Offer",                color: "#0ca30c" },
};

const SUBMITTED = new Set(["applied", "screen", "interview", "offer", "rejected", "withdrawn"]);

/** Path of nodes one job takes through the funnel. */
function pathFor(j: JobPosting): NodeKey[] {
  const applied = !!j.applied_at || SUBMITTED.has(j.status);
  if (!applied) {
    const end: NodeKey = j.status === "skipped" ? "skipped" : j.status === "interested" ? "interested" : j.status === "closed" ? "closedNot" : "unreviewed";
    return ["tracked", end];
  }
  if (j.status === "screen" || j.status === "interview" || j.status === "offer") return ["tracked", "applied", "engaged", j.status];
  const end: NodeKey = j.status === "rejected" ? "rejected" : j.status === "withdrawn" ? "withdrawn" : j.status === "closed" ? "closed" : "waiting";
  return ["tracked", "applied", end];
}

type N = { key: NodeKey; label: string; color: string; count: number };
type L = { source: number; target: number; value: number };

function buildGraph(jobs: JobPosting[], includeUnreviewed: boolean) {
  const counts = new Map<string, number>();
  const nodeCount = new Map<NodeKey, number>();
  for (const j of jobs) {
    const path = pathFor(j);
    if (!includeUnreviewed && path[1] === "unreviewed") continue;
    path.forEach(k => nodeCount.set(k, (nodeCount.get(k) ?? 0) + 1));
    for (let i = 0; i < path.length - 1; i++) {
      const id = `${path[i]}>${path[i + 1]}`;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const keys = [...nodeCount.keys()];
  const nodes: N[] = keys.map(k => ({ key: k, ...NODE[k], count: nodeCount.get(k)! }));
  const links: L[] = [...counts].map(([id, value]) => {
    const [s, t] = id.split(">") as NodeKey[];
    return { source: keys.indexOf(s), target: keys.indexOf(t), value };
  });
  return { nodes, links };
}

export default function JobsFunnel({ jobs }: { jobs: JobPosting[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [includeUnreviewed, setIncludeUnreviewed] = useState(false);
  const [hover, setHover] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { nodes, links } = buildGraph(jobs, includeUnreviewed);
  const unreviewed = jobs.filter(j => pathFor(j)[1] === "unreviewed").length;
  const total = nodes.find(n => n.key === "tracked")?.count ?? 0;

  const narrow = width < 640;
  const H = narrow ? 300 : 340;
  const labelRoom = narrow ? 92 : 150;   // space right of the last column for its labels
  const layout = sankey<N, L>()
    .nodeId(d => (d as SankeyNode<N, L>).index!)
    .nodeAlign(sankeyLeft)
    .nodeWidth(12)
    .nodePadding(narrow ? 14 : 18)
    .extent([[1, 8], [width - labelRoom, H - 8]]);
  const graph = links.length ? layout({ nodes: nodes.map(d => ({ ...d })), links: links.map(d => ({ ...d })) }) : null;

  const pct = (v: number) => (total ? `${Math.round((v / total) * 100)}%` : "");
  const tip = (e: MouseEvent, text: string) => {
    const r = wrap.current!.getBoundingClientRect();
    setHover({ text, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div className="mb-8 border border-[#111] rounded-[28px] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="text-xl font-medium tracking-[-0.03em]">Where your jobs went</h2>
        <label className="flex items-center gap-2 text-[12px] text-[#5f5e5a] cursor-pointer select-none">
          <input id="funnel-unreviewed" type="checkbox" checked={includeUnreviewed} onChange={e => setIncludeUnreviewed(e.target.checked)} className="accent-[#111]" />
          Include {unreviewed} not yet reviewed
        </label>
      </div>
      <p className="text-[12px] text-[#5f5e5a] mb-3">
        {total} jobs{includeUnreviewed ? "" : " you've looked at"} · hover a band for counts. Current status only, so "Rejected" doesn't say at which stage.
      </p>
      <div ref={wrap} className="relative">
        {!graph ? (
          <p className="text-[13px] text-[#5f5e5a] py-10 text-center">No jobs to chart yet.</p>
        ) : (
          <svg width={width} height={H} role="img" aria-label="Sankey chart of job search outcomes" className="block overflow-visible">
            <g fill="none">
              {graph.links.map((l: SankeyLink<N, L>, i) => {
                const t = l.target as SankeyNode<N, L>;
                const s = l.source as SankeyNode<N, L>;
                return (
                  <path key={i} d={sankeyLinkHorizontal()(l) ?? undefined} stroke={t.color}
                    strokeOpacity={hover?.text.startsWith(`${s.label} → ${t.label}`) ? 0.55 : 0.28}
                    strokeWidth={Math.max(1, l.width ?? 1)}
                    onMouseMove={e => tip(e, `${s.label} → ${t.label}: ${l.value} (${pct(l.value)})`)}
                    onMouseLeave={() => setHover(null)} className="transition-[stroke-opacity] cursor-default" />
                );
              })}
            </g>
            {graph.nodes.map(n => {
              const x0 = n.x0 ?? 0, x1 = n.x1 ?? 0, y0 = n.y0 ?? 0, y1 = n.y1 ?? 0;
              const first = x0 === 0;
              const tx = x1 + 6; // labels sit right of each node; labelRoom keeps the last column's labels inside
              return (
                <g key={n.key}
                  onMouseMove={e => tip(e, `${n.label}: ${n.count} (${pct(n.count)})`)} onMouseLeave={() => setHover(null)}>
                  <rect x={x0} y={y0} width={x1 - x0} height={Math.max(2, y1 - y0)} rx={3} fill={n.color} stroke="#ECEBE7" strokeWidth={1} />
                  <text x={tx} y={(y0 + y1) / 2} dy="0.35em" fontSize={narrow ? 11 : 12.5} fill="#111"
                    className={first ? "font-medium" : ""} style={{ paintOrder: "stroke", stroke: "#ECEBE7", strokeWidth: 3 }}>
                    {n.label} <tspan fill="#5f5e5a">{n.count}</tspan>
                  </text>
                </g>
              );
            })}
          </svg>
        )}
        {hover && (
          <div className="absolute pointer-events-none z-10 bg-white border border-[#C9C7BF] rounded-lg px-2.5 py-1.5 text-[12px] text-[#111] shadow-sm whitespace-nowrap"
            style={{ left: Math.min(hover.x + 12, width - 200), top: hover.y + 12 }}>
            {hover.text}
          </div>
        )}
      </div>
    </div>
  );
}
