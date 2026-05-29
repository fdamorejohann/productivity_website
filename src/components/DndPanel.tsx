import { useState, useEffect } from "react";
import { db } from "../lib/db";

const uid = () => crypto.randomUUID();

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  description: string;
  system: string;
  is_dm: boolean;
  created_at: string;
}

interface DndCharacter {
  id: string;
  campaign_id: string;
  type: "pc" | "npc";
  name: string;
  race: string;
  class: string;
  level: number | null;
  description: string;
  notes: string;
}

interface DndLocation {
  id: string;
  campaign_id: string;
  name: string;
  type: string;
  description: string;
  notes: string;
}

interface DndSession {
  id: string;
  campaign_id: string;
  session_number: number;
  date: string;
  title: string;
  summary: string;
  notes: string;
}

interface DndLore {
  id: string;
  campaign_id: string;
  category: string;
  title: string;
  content: string;
}

interface DndQuest {
  id: string;
  campaign_id: string;
  title: string;
  status: "active" | "completed" | "failed" | "rumor";
  description: string;
  notes: string;
}

interface DndConcept {
  id: string;
  campaign_id: string;
  type: string;
  name: string;
  content: string;
  tags: string;
}

interface Combatant {
  id: string;
  name: string;
  initiative: number;
  hp: number;
  maxHp: number;
  ac: number;
  cr: string;
  kind: "pc" | "enemy";
}

type CampaignTab = "sessions" | "players" | "npcs" | "locations" | "lore" | "quests" | "concepts" | "combat";

const TAB_CONFIG: { key: CampaignTab; label: string; emoji: string }[] = [
  { key: "sessions",  label: "Sessions",        emoji: "📜" },
  { key: "players",   label: "Player Characters",emoji: "🧙" },
  { key: "npcs",      label: "NPCs",             emoji: "👥" },
  { key: "locations", label: "Locations",        emoji: "🗺️" },
  { key: "lore",      label: "World Building",   emoji: "📚" },
  { key: "quests",    label: "Quests",           emoji: "⚔️" },
  { key: "concepts",  label: "Concepts",         emoji: "📝" },
  { key: "combat",    label: "Combat",            emoji: "🎲" },
];

const CONCEPT_TYPES = ["Monster", "Item", "Spell", "Trap", "Puzzle", "Mechanic", "Other"];

const LORE_CATEGORIES = ["Factions", "History", "Religion", "Magic", "Geography", "Politics", "Other"];
const LOCATION_TYPES = ["City", "Town", "Village", "Dungeon", "Wilderness", "Building", "Region", "Other"];
const QUEST_STATUSES: { key: DndQuest["status"]; label: string; color: string }[] = [
  { key: "active",    label: "Active",    color: "#22c55e" },
  { key: "completed", label: "Completed", color: "#3b82f6" },
  { key: "failed",    label: "Failed",    color: "#ef4444" },
  { key: "rumor",     label: "Rumor",     color: "#f59e0b" },
];

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function DndPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    db.dnd.campaigns.list().then((c: Campaign[]) => {
      setCampaigns(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (selected) {
    return (
      <CampaignView
        campaign={selected}
        onBack={() => setSelected(null)}
        onDelete={(id) => { setCampaigns(p => p.filter(c => c.id !== id)); setSelected(null); }}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">🐉 Campaigns</h1>
          <p className="text-xs text-gray-500 mt-1">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-white text-black px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors"
        >+ New Campaign</button>
      </div>

      {loading && <p className="text-gray-600 text-sm animate-pulse">Loading…</p>}

      {!loading && campaigns.length === 0 && (
        <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-10 text-center">
          <p className="text-4xl mb-3">🐉</p>
          <p className="text-white font-medium mb-1">No campaigns yet</p>
          <p className="text-xs text-gray-500">Create your first campaign to get started</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {campaigns.map(c => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="bg-[#1e1e1e] border border-[#2e2e2e] hover:border-[#444] rounded-2xl p-5 text-left transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white font-semibold text-lg group-hover:text-amber-400 transition-colors">{c.name}</p>
                {c.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.description}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                <span className="text-xs text-gray-600 bg-[#252525] px-2 py-0.5 rounded-full">{c.system}</span>
                {c.is_dm && <span className="text-xs text-amber-500">DM</span>}
              </div>
            </div>
          </button>
        ))}
      </div>

      {showNew && (
        <NewCampaignModal
          onClose={() => setShowNew(false)}
          onCreate={(c) => { setCampaigns(p => [...p, c]); setShowNew(false); setSelected(c); }}
        />
      )}
    </div>
  );
}

// ─── New Campaign Modal ───────────────────────────────────────────────────────

function NewCampaignModal({ onClose, onCreate }: { onClose: () => void; onCreate: (c: Campaign) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [system, setSystem] = useState("D&D 5e");
  const [isDm, setIsDm] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const c = await db.dnd.campaigns.upsert({ id: uid(), name: name.trim(), description, system, is_dm: isDm }) as Campaign;
    onCreate(c);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg mb-5">New Campaign</h2>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Campaign Name *</p>
            <input autoFocus className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" placeholder="The Curse of Strahd…" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Description</p>
            <textarea className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" rows={3} placeholder="A brief summary of the campaign…" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">System</p>
            <select className="w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" value={system} onChange={e => setSystem(e.target.value)}>
              {["D&D 5e", "D&D 2024", "Pathfinder 2e", "Call of Cthulhu", "Other"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isDm} onChange={e => setIsDm(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-gray-300">I am the DM for this campaign</span>
          </label>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={save} disabled={!name.trim() || saving} className="bg-amber-500 text-black px-5 py-2 rounded-xl text-sm font-medium hover:bg-amber-400 disabled:opacity-50 transition-colors">{saving ? "Creating…" : "Create Campaign"}</button>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-white transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign View ────────────────────────────────────────────────────────────

function CampaignView({ campaign, onBack, onDelete }: { campaign: Campaign; onBack: () => void; onDelete: (id: string) => void }) {
  const [tab, setTab] = useState<CampaignTab>("sessions");
  const [characters, setCharacters] = useState<DndCharacter[]>([]);
  const [locations, setLocations] = useState<DndLocation[]>([]);
  const [sessions, setSessions] = useState<DndSession[]>([]);
  const [lore, setLore] = useState<DndLore[]>([]);
  const [quests, setQuests] = useState<DndQuest[]>([]);
  const [concepts, setConcepts] = useState<DndConcept[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      db.dnd.characters.list(campaign.id),
      db.dnd.locations.list(campaign.id),
      db.dnd.sessions.list(campaign.id),
      db.dnd.lore.list(campaign.id),
      db.dnd.quests.list(campaign.id),
      db.dnd.concepts.list(campaign.id),
    ]).then(([chars, locs, sess, lor, q, con]) => {
      setCharacters(chars as DndCharacter[]);
      setLocations(locs as DndLocation[]);
      setSessions(sess as DndSession[]);
      setLore(lor as DndLore[]);
      setQuests(q as DndQuest[]);
      setConcepts(con as DndConcept[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [campaign.id]);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-white transition-colors mb-2 flex items-center gap-1">← All Campaigns</button>
          <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-600 bg-[#252525] px-2 py-0.5 rounded-full">{campaign.system}</span>
            {campaign.is_dm && <span className="text-xs text-amber-500 font-medium">Dungeon Master</span>}
          </div>
          {campaign.description && <p className="text-sm text-gray-500 mt-2 max-w-lg">{campaign.description}</p>}
        </div>
        <button
          onClick={async () => { if (confirm("Delete this campaign and all its data?")) { await db.dnd.campaigns.delete(campaign.id); onDelete(campaign.id); } }}
          className="text-xs text-gray-600 hover:text-red-400 transition-colors"
        >Delete</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {TAB_CONFIG.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === t.key ? "bg-white text-black font-medium" : "text-gray-400 hover:text-white border border-[#2e2e2e]"}`}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-600 text-sm animate-pulse">Loading…</p> : (
        <>
          {tab === "sessions"  && <SessionsTab campaignId={campaign.id} sessions={sessions} setSessions={setSessions} />}
          {tab === "players"   && <CharactersTab campaignId={campaign.id} type="pc" characters={characters} setCharacters={setCharacters} />}
          {tab === "npcs"      && <CharactersTab campaignId={campaign.id} type="npc" characters={characters} setCharacters={setCharacters} />}
          {tab === "locations" && <LocationsTab campaignId={campaign.id} locations={locations} setLocations={setLocations} />}
          {tab === "lore"      && <LoreTab campaignId={campaign.id} lore={lore} setLore={setLore} />}
          {tab === "quests"    && <QuestsTab campaignId={campaign.id} quests={quests} setQuests={setQuests} />}
          {tab === "concepts"  && <ConceptsTab campaignId={campaign.id} concepts={concepts} setConcepts={setConcepts} />}
          {tab === "combat"    && <CombatTab />}
        </>
      )}
    </div>
  );
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

function SessionsTab({ campaignId, sessions, setSessions }: { campaignId: string; sessions: DndSession[]; setSessions: React.Dispatch<React.SetStateAction<DndSession[]>> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DndSession | null>(null);

  const sorted = [...sessions].sort((a, b) => b.session_number - a.session_number);
  const nextNum = sessions.length ? Math.max(...sessions.map(s => s.session_number)) + 1 : 1;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">{sessions.length} sessions logged</p>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#2e2e2e] rounded-lg px-3 py-1.5 transition-colors">+ Log Session</button>
      </div>

      {sessions.length === 0 && <EmptyState emoji="📜" text="No sessions yet" sub="Log your first session to start tracking your adventure" />}

      {sorted.map(s => (
        <div key={s.id} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden">
          <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#242424] transition-colors text-left" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-500 font-medium">Session {s.session_number}</span>
                {s.date && <span className="text-xs text-gray-600">{new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>}
              </div>
              <p className="text-white font-medium text-sm mt-0.5">{s.title || "Untitled Session"}</p>
            </div>
            <span className="text-gray-600">{expanded === s.id ? "▲" : "▼"}</span>
          </button>
          {expanded === s.id && (
            <div className="px-5 pb-5 border-t border-[#2a2a2a] pt-4 space-y-3">
              {s.summary && <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Summary</p><p className="text-sm text-gray-300 whitespace-pre-wrap">{s.summary}</p></div>}
              {s.notes && <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p><p className="text-sm text-gray-400 whitespace-pre-wrap">{s.notes}</p></div>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setEditing(s); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#333] rounded-lg px-3 py-1.5 transition-colors">Edit</button>
                <button onClick={async () => { await db.dnd.sessions.delete(s.id); setSessions(p => p.filter(x => x.id !== s.id)); }} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showForm && (
        <SessionForm
          campaignId={campaignId}
          initial={editing}
          defaultNum={nextNum}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={(s) => { setSessions(p => editing ? p.map(x => x.id === s.id ? s : x) : [s, ...p]); setShowForm(false); setEditing(null); setExpanded(s.id); }}
        />
      )}
    </div>
  );
}

function SessionForm({ campaignId, initial, defaultNum, onClose, onSave }: { campaignId: string; initial: DndSession | null; defaultNum: number; onClose: () => void; onSave: (s: DndSession) => void }) {
  const [num, setNum] = useState(initial?.session_number ?? defaultNum);
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const s = await db.dnd.sessions.upsert({ id: initial?.id ?? uid(), campaign_id: campaignId, session_number: num, date, title, summary, notes }) as DndSession;
    onSave(s);
  };

  return (
    <Modal title={initial ? "Edit Session" : "Log Session"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Session #"><input type="number" className={INPUT} value={num} onChange={e => setNum(parseInt(e.target.value))} /></Field>
          <Field label="Date"><input type="date" className={INPUT} value={date} onChange={e => setDate(e.target.value)} /></Field>
        </div>
        <Field label="Title"><input className={INPUT} placeholder="The Mines of Madness…" value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <Field label="Summary"><textarea className={`${INPUT} resize-none`} rows={4} placeholder="What happened this session?" value={summary} onChange={e => setSummary(e.target.value)} /></Field>
        <Field label="Notes"><textarea className={`${INPUT} resize-none`} rows={3} placeholder="Clues, loose ends, things to remember…" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      </div>
      <SaveBar onClose={onClose} onSave={save} saving={saving} />
    </Modal>
  );
}

// ─── Characters Tab ───────────────────────────────────────────────────────────

function CharactersTab({ campaignId, type, characters, setCharacters }: { campaignId: string; type: "pc" | "npc"; characters: DndCharacter[]; setCharacters: React.Dispatch<React.SetStateAction<DndCharacter[]>> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DndCharacter | null>(null);

  const filtered = characters.filter(c => c.type === type);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">{filtered.length} {type === "pc" ? "player characters" : "NPCs"}</p>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#2e2e2e] rounded-lg px-3 py-1.5 transition-colors">+ Add {type === "pc" ? "Character" : "NPC"}</button>
      </div>

      {filtered.length === 0 && <EmptyState emoji={type === "pc" ? "🧙" : "👥"} text={`No ${type === "pc" ? "player characters" : "NPCs"} yet`} sub={type === "pc" ? "Add the heroes of your story" : "Add the people your party has met"} />}

      <div className="grid grid-cols-2 gap-3">
        {filtered.map(c => (
          <div key={c.id} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden">
            <button className="w-full text-left px-4 py-3 hover:bg-[#242424] transition-colors" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
              <p className="text-white font-medium text-sm">{c.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {[c.race, c.class, c.level ? `Lvl ${c.level}` : null].filter(Boolean).join(" · ") || "No details"}
              </p>
            </button>
            {expanded === c.id && (
              <div className="px-4 pb-4 border-t border-[#2a2a2a] pt-3 space-y-2">
                {c.description && <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p><p className="text-xs text-gray-300 whitespace-pre-wrap">{c.description}</p></div>}
                {c.notes && <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p><p className="text-xs text-gray-400 whitespace-pre-wrap">{c.notes}</p></div>}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setEditing(c); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#333] rounded-lg px-3 py-1.5 transition-colors">Edit</button>
                  <button onClick={async () => { await db.dnd.characters.delete(c.id); setCharacters(p => p.filter(x => x.id !== c.id)); }} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showForm && (
        <CharacterForm campaignId={campaignId} type={type} initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={(c) => { setCharacters(p => editing ? p.map(x => x.id === c.id ? c : x) : [...p, c]); setShowForm(false); setEditing(null); setExpanded(c.id); }}
        />
      )}
    </div>
  );
}

function CharacterForm({ campaignId, type, initial, onClose, onSave }: { campaignId: string; type: "pc" | "npc"; initial: DndCharacter | null; onClose: () => void; onSave: (c: DndCharacter) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [race, setRace] = useState(initial?.race ?? "");
  const [cls, setCls] = useState(initial?.class ?? "");
  const [level, setLevel] = useState(initial?.level ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const c = await db.dnd.characters.upsert({ id: initial?.id ?? uid(), campaign_id: campaignId, type, name, race, class: cls, level: level ? Number(level) : null, description, notes }) as DndCharacter;
    onSave(c);
  };

  return (
    <Modal title={initial ? `Edit ${type === "pc" ? "Character" : "NPC"}` : `New ${type === "pc" ? "Character" : "NPC"}`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name *"><input autoFocus className={INPUT} placeholder={type === "pc" ? "Thorin Stonehelm…" : "Innkeeper Marta…"} value={name} onChange={e => setName(e.target.value)} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Race"><input className={INPUT} placeholder="Dwarf" value={race} onChange={e => setRace(e.target.value)} /></Field>
          <Field label="Class"><input className={INPUT} placeholder="Fighter" value={cls} onChange={e => setCls(e.target.value)} /></Field>
          {type === "pc" && <Field label="Level"><input type="number" className={INPUT} placeholder="1" value={level} onChange={e => setLevel(e.target.value)} /></Field>}
        </div>
        <Field label="Description"><textarea className={`${INPUT} resize-none`} rows={3} placeholder="Appearance, personality, role in the story…" value={description} onChange={e => setDescription(e.target.value)} /></Field>
        <Field label="Notes"><textarea className={`${INPUT} resize-none`} rows={2} placeholder="Secrets, quest hooks, relationships…" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      </div>
      <SaveBar onClose={onClose} onSave={save} saving={saving} disabled={!name.trim()} />
    </Modal>
  );
}

// ─── Locations Tab ────────────────────────────────────────────────────────────

function LocationsTab({ campaignId, locations, setLocations }: { campaignId: string; locations: DndLocation[]; setLocations: React.Dispatch<React.SetStateAction<DndLocation[]>> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DndLocation | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">{locations.length} locations</p>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#2e2e2e] rounded-lg px-3 py-1.5 transition-colors">+ Add Location</button>
      </div>

      {locations.length === 0 && <EmptyState emoji="🗺️" text="No locations yet" sub="Document the places your party has explored" />}

      {locations.map(l => (
        <div key={l.id} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden">
          <button className="w-full text-left flex items-center justify-between px-5 py-4 hover:bg-[#242424] transition-colors" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
            <div>
              <p className="text-white font-medium text-sm">{l.name}</p>
              {l.type && <p className="text-xs text-gray-500 mt-0.5">{l.type}</p>}
            </div>
            <span className="text-gray-600">{expanded === l.id ? "▲" : "▼"}</span>
          </button>
          {expanded === l.id && (
            <div className="px-5 pb-5 border-t border-[#2a2a2a] pt-4 space-y-3">
              {l.description && <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p><p className="text-sm text-gray-300 whitespace-pre-wrap">{l.description}</p></div>}
              {l.notes && <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p><p className="text-sm text-gray-400 whitespace-pre-wrap">{l.notes}</p></div>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setEditing(l); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#333] rounded-lg px-3 py-1.5 transition-colors">Edit</button>
                <button onClick={async () => { await db.dnd.locations.delete(l.id); setLocations(p => p.filter(x => x.id !== l.id)); }} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showForm && (
        <LocationForm campaignId={campaignId} initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={(l) => { setLocations(p => editing ? p.map(x => x.id === l.id ? l : x) : [...p, l]); setShowForm(false); setEditing(null); setExpanded(l.id); }}
        />
      )}
    </div>
  );
}

function LocationForm({ campaignId, initial, onClose, onSave }: { campaignId: string; initial: DndLocation | null; onClose: () => void; onSave: (l: DndLocation) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const l = await db.dnd.locations.upsert({ id: initial?.id ?? uid(), campaign_id: campaignId, name, type, description, notes }) as DndLocation;
    onSave(l);
  };

  return (
    <Modal title={initial ? "Edit Location" : "New Location"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *"><input autoFocus className={INPUT} placeholder="Baldur's Gate…" value={name} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Type">
            <select className={INPUT} value={type} onChange={e => setType(e.target.value)}>
              <option value="">— Select —</option>
              {LOCATION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description"><textarea className={`${INPUT} resize-none`} rows={4} placeholder="What does this place look like? Who lives here?" value={description} onChange={e => setDescription(e.target.value)} /></Field>
        <Field label="Notes"><textarea className={`${INPUT} resize-none`} rows={2} placeholder="Secrets, lore, important NPCs here…" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      </div>
      <SaveBar onClose={onClose} onSave={save} saving={saving} disabled={!name.trim()} />
    </Modal>
  );
}

// ─── Lore Tab ─────────────────────────────────────────────────────────────────

function LoreTab({ campaignId, lore, setLore }: { campaignId: string; lore: DndLore[]; setLore: React.Dispatch<React.SetStateAction<DndLore[]>> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DndLore | null>(null);
  const [filterCat, setFilterCat] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(lore.map(l => l.category).filter(Boolean)))];
  const filtered = filterCat === "All" ? lore : lore.filter(l => l.category === filterCat);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {categories.map(c => (
            <button key={c} onClick={() => setFilterCat(c)} className={`text-xs px-2 py-1 rounded-lg transition-colors ${filterCat === c ? "bg-white text-black font-medium" : "text-gray-500 hover:text-white border border-[#2e2e2e]"}`}>{c}</button>
          ))}
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#2e2e2e] rounded-lg px-3 py-1.5 transition-colors">+ Add Entry</button>
      </div>

      {filtered.length === 0 && <EmptyState emoji="📚" text="No world building yet" sub="Document factions, history, religion, and lore" />}

      {filtered.map(l => (
        <div key={l.id} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden">
          <button className="w-full text-left flex items-center justify-between px-5 py-4 hover:bg-[#242424] transition-colors" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white font-medium text-sm">{l.title}</p>
                {l.category && <span className="text-xs text-gray-600 bg-[#252525] px-2 py-0.5 rounded-full">{l.category}</span>}
              </div>
              {l.content && <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{l.content}</p>}
            </div>
            <span className="text-gray-600">{expanded === l.id ? "▲" : "▼"}</span>
          </button>
          {expanded === l.id && (
            <div className="px-5 pb-5 border-t border-[#2a2a2a] pt-4">
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{l.content}</p>
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setEditing(l); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#333] rounded-lg px-3 py-1.5 transition-colors">Edit</button>
                <button onClick={async () => { await db.dnd.lore.delete(l.id); setLore(p => p.filter(x => x.id !== l.id)); }} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Delete</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {showForm && (
        <LoreForm campaignId={campaignId} initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={(l) => { setLore(p => editing ? p.map(x => x.id === l.id ? l : x) : [...p, l]); setShowForm(false); setEditing(null); setExpanded(l.id); }}
        />
      )}
    </div>
  );
}

function LoreForm({ campaignId, initial, onClose, onSave }: { campaignId: string; initial: DndLore | null; onClose: () => void; onSave: (l: DndLore) => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const l = await db.dnd.lore.upsert({ id: initial?.id ?? uid(), campaign_id: campaignId, category, title, content }) as DndLore;
    onSave(l);
  };

  return (
    <Modal title={initial ? "Edit Entry" : "New Lore Entry"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title *"><input autoFocus className={INPUT} placeholder="The Order of the Crimson Dawn…" value={title} onChange={e => setTitle(e.target.value)} /></Field>
          <Field label="Category">
            <select className={INPUT} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">— Select —</option>
              {LORE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Content"><textarea className={`${INPUT} resize-none`} rows={6} placeholder="Write everything you know about this…" value={content} onChange={e => setContent(e.target.value)} /></Field>
      </div>
      <SaveBar onClose={onClose} onSave={save} saving={saving} disabled={!title.trim()} />
    </Modal>
  );
}

// ─── Quests Tab ───────────────────────────────────────────────────────────────

function QuestsTab({ campaignId, quests, setQuests }: { campaignId: string; quests: DndQuest[]; setQuests: React.Dispatch<React.SetStateAction<DndQuest[]>> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DndQuest | null>(null);
  const [filter, setFilter] = useState<string>("active");

  const filtered = filter === "all" ? quests : quests.filter(q => q.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button onClick={() => setFilter("active")} className={`text-xs px-2 py-1 rounded-lg transition-colors ${filter === "active" ? "bg-white text-black font-medium" : "text-gray-500 hover:text-white border border-[#2e2e2e]"}`}>Active</button>
          <button onClick={() => setFilter("all")} className={`text-xs px-2 py-1 rounded-lg transition-colors ${filter === "all" ? "bg-white text-black font-medium" : "text-gray-500 hover:text-white border border-[#2e2e2e]"}`}>All</button>
          {QUEST_STATUSES.filter(s => s.key !== "active").map(s => (
            <button key={s.key} onClick={() => setFilter(s.key)} className={`text-xs px-2 py-1 rounded-lg transition-colors ${filter === s.key ? "bg-white text-black font-medium" : "text-gray-500 hover:text-white border border-[#2e2e2e]"}`}>{s.label}</button>
          ))}
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#2e2e2e] rounded-lg px-3 py-1.5 transition-colors">+ Add Quest</button>
      </div>

      {filtered.length === 0 && <EmptyState emoji="⚔️" text="No quests here" sub="Track active quests, rumors, and completed adventures" />}

      {filtered.map(q => {
        const statusInfo = QUEST_STATUSES.find(s => s.key === q.status)!;
        return (
          <div key={q.id} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden">
            <button className="w-full text-left flex items-center justify-between px-5 py-4 hover:bg-[#242424] transition-colors" onClick={() => setExpanded(expanded === q.id ? null : q.id)}>
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusInfo.color }} />
                <div>
                  <p className="text-white font-medium text-sm">{q.title}</p>
                  {q.description && <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">{q.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                <span className="text-gray-600">{expanded === q.id ? "▲" : "▼"}</span>
              </div>
            </button>
            {expanded === q.id && (
              <div className="px-5 pb-5 border-t border-[#2a2a2a] pt-4 space-y-3">
                {q.description && <p className="text-sm text-gray-300 whitespace-pre-wrap">{q.description}</p>}
                {q.notes && <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p><p className="text-sm text-gray-400 whitespace-pre-wrap">{q.notes}</p></div>}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => { setEditing(q); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#333] rounded-lg px-3 py-1.5 transition-colors">Edit</button>
                  <button onClick={async () => { await db.dnd.quests.delete(q.id); setQuests(p => p.filter(x => x.id !== q.id)); }} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {showForm && (
        <QuestForm campaignId={campaignId} initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={(q) => { setQuests(p => editing ? p.map(x => x.id === q.id ? q : x) : [...p, q]); setShowForm(false); setEditing(null); setExpanded(q.id); }}
        />
      )}
    </div>
  );
}

function QuestForm({ campaignId, initial, onClose, onSave }: { campaignId: string; initial: DndQuest | null; onClose: () => void; onSave: (q: DndQuest) => void }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [status, setStatus] = useState<DndQuest["status"]>(initial?.status ?? "active");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const q = await db.dnd.quests.upsert({ id: initial?.id ?? uid(), campaign_id: campaignId, title, status, description, notes }) as DndQuest;
    onSave(q);
  };

  return (
    <Modal title={initial ? "Edit Quest" : "New Quest"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title *"><input autoFocus className={INPUT} placeholder="Find the Lost Artifact…" value={title} onChange={e => setTitle(e.target.value)} /></Field>
          <Field label="Status">
            <select className={INPUT} value={status} onChange={e => setStatus(e.target.value as DndQuest["status"])}>
              {QUEST_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description"><textarea className={`${INPUT} resize-none`} rows={4} placeholder="What is this quest about? Who gave it?" value={description} onChange={e => setDescription(e.target.value)} /></Field>
        <Field label="Notes"><textarea className={`${INPUT} resize-none`} rows={2} placeholder="Leads, clues, rewards…" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      </div>
      <SaveBar onClose={onClose} onSave={save} saving={saving} disabled={!title.trim()} />
    </Modal>
  );
}

// ─── Concepts Tab ─────────────────────────────────────────────────────────────

const CONCEPT_TYPE_COLORS: Record<string, string> = {
  Monster: "#ef4444", Item: "#f59e0b", Spell: "#8b5cf6",
  Trap: "#f97316", Puzzle: "#06b6d4", Mechanic: "#10b981", Other: "#6b7280",
};

function ConceptsTab({ campaignId, concepts, setConcepts }: { campaignId: string; concepts: DndConcept[]; setConcepts: React.Dispatch<React.SetStateAction<DndConcept[]>> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DndConcept | null>(null);
  const [filterType, setFilterType] = useState("All");

  const types = ["All", ...Array.from(new Set(concepts.map(c => c.type).filter(Boolean)))];
  const filtered = filterType === "All" ? concepts : concepts.filter(c => c.type === filterType);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1 flex-wrap">
          {types.map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${filterType === t ? "bg-white text-black font-medium" : "text-gray-500 hover:text-white border border-[#2e2e2e]"}`}>
              {t}
            </button>
          ))}
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#2e2e2e] rounded-lg px-3 py-1.5 transition-colors">+ New Concept</button>
      </div>

      {filtered.length === 0 && <EmptyState emoji="📝" text="No concepts yet" sub="Document monsters, items, spells, traps, and other ideas" />}

      <div className="grid grid-cols-2 gap-3">
        {filtered.map(c => {
          const color = CONCEPT_TYPE_COLORS[c.type] ?? "#6b7280";
          return (
            <div key={c.id} className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl overflow-hidden">
              <button className="w-full text-left px-4 py-3 hover:bg-[#242424] transition-colors" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white font-medium text-sm">{c.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium" style={{ backgroundColor: color + "22", color }}>{c.type || "Other"}</span>
                </div>
                {c.content && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{c.content}</p>}
                {c.tags && <p className="text-xs text-gray-700 mt-1">{c.tags}</p>}
              </button>
              {expanded === c.id && (
                <div className="px-4 pb-4 border-t border-[#2a2a2a] pt-3">
                  {c.content && <p className="text-sm text-gray-300 whitespace-pre-wrap">{c.content}</p>}
                  {c.tags && <p className="text-xs text-gray-600 mt-2">Tags: {c.tags}</p>}
                  <div className="flex gap-3 mt-3">
                    <button onClick={() => { setEditing(c); setShowForm(true); }} className="text-xs text-gray-400 hover:text-white border border-[#333] rounded-lg px-3 py-1.5 transition-colors">Edit</button>
                    <button onClick={async () => { await db.dnd.concepts.delete(c.id); setConcepts(p => p.filter(x => x.id !== c.id)); }} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Delete</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && (
        <ConceptForm campaignId={campaignId} initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={(c) => { setConcepts(p => editing ? p.map(x => x.id === c.id ? c : x) : [...p, c]); setShowForm(false); setEditing(null); setExpanded(c.id); }}
        />
      )}
    </div>
  );
}

function ConceptForm({ campaignId, initial, onClose, onSave }: { campaignId: string; initial: DndConcept | null; onClose: () => void; onSave: (c: DndConcept) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "Monster");
  const [content, setContent] = useState(initial?.content ?? "");
  const [tags, setTags] = useState(initial?.tags ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const c = await db.dnd.concepts.upsert({ id: initial?.id ?? uid(), campaign_id: campaignId, name, type, content, tags }) as DndConcept;
    onSave(c);
  };

  return (
    <Modal title={initial ? "Edit Concept" : "New Concept"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *"><input autoFocus className={INPUT} placeholder="Beholder, Vorpal Sword…" value={name} onChange={e => setName(e.target.value)} /></Field>
          <Field label="Type">
            <select className={INPUT} value={type} onChange={e => setType(e.target.value)}>
              {CONCEPT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notes"><textarea className={`${INPUT} resize-none`} rows={6} placeholder="Stats, description, how it works, ideas for using it…" value={content} onChange={e => setContent(e.target.value)} /></Field>
        <Field label="Tags"><input className={INPUT} placeholder="boss, undead, rare…" value={tags} onChange={e => setTags(e.target.value)} /></Field>
      </div>
      <SaveBar onClose={onClose} onSave={save} saving={saving} disabled={!name.trim()} />
    </Modal>
  );
}

// ─── Combat Tab ───────────────────────────────────────────────────────────────

function CombatTab() {
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [turnIdx, setTurnIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [aName, setAName] = useState("");
  const [aInit, setAInit] = useState("");
  const [aMaxHp, setAMaxHp] = useState("");
  const [aAc, setAAc] = useState("");
  const [aCr, setACr] = useState("");
  const [aKind, setAKind] = useState<"pc" | "enemy">("enemy");
  const [dmgInput, setDmgInput] = useState<Record<string, string>>({});

  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
  const activeTurn = sorted[turnIdx % Math.max(sorted.length, 1)]?.id;

  const addCombatant = () => {
    if (!aName.trim()) return;
    const hp = parseInt(aMaxHp) || 10;
    const c: Combatant = { id: uid(), name: aName.trim(), initiative: parseInt(aInit) || 0, hp, maxHp: hp, ac: parseInt(aAc) || 0, cr: aCr.trim(), kind: aKind };
    setCombatants(p => [...p, c]);
    setAName(""); setAInit(""); setAMaxHp(""); setAAc(""); setACr(""); setAKind("enemy");
    setShowAdd(false);
  };

  const adjustHp = (id: string, delta: number) => {
    setCombatants(p => p.map(c => c.id === id ? { ...c, hp: Math.max(0, Math.min(c.maxHp, c.hp + delta)) } : c));
  };

  const applyDmg = (id: string) => {
    const val = parseInt(dmgInput[id] ?? "0");
    if (!val) return;
    adjustHp(id, -val);
    setDmgInput(p => ({ ...p, [id]: "" }));
  };

  const nextTurn = () => {
    const next = (turnIdx + 1) % Math.max(sorted.length, 1);
    if (next === 0) setRound(r => r + 1);
    setTurnIdx(next);
  };

  const reset = () => { if (confirm("Clear all combatants and reset combat?")) { setCombatants([]); setTurnIdx(0); setRound(1); } };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 bg-[#252525] px-3 py-1 rounded-full">Round {round}</span>
          {sorted.length > 0 && (
            <button onClick={nextTurn} className="bg-amber-500 text-black text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-400 transition-colors">Next →</button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(s => !s)} className="text-xs text-gray-400 hover:text-white border border-[#2e2e2e] rounded-lg px-3 py-1.5 transition-colors">+ Add</button>
          {combatants.length > 0 && <button onClick={reset} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Reset</button>}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-600 mb-1">Name *</p>
              <input autoFocus className={INPUT} placeholder="Goblin #1" value={aName} onChange={e => setAName(e.target.value)} onKeyDown={e => e.key === "Enter" && addCombatant()} />
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Type</p>
              <div className="flex gap-1.5 h-[38px]">
                {(["enemy", "pc"] as const).map(k => (
                  <button key={k} onClick={() => setAKind(k)}
                    className={`flex-1 text-xs rounded-lg border transition-colors ${aKind === k ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-[#333] text-gray-500 hover:text-white"}`}>
                    {k === "pc" ? "Player" : "Enemy"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div><p className="text-xs text-gray-600 mb-1">Init</p><input type="number" className={INPUT} placeholder="15" value={aInit} onChange={e => setAInit(e.target.value)} onKeyDown={e => e.key === "Enter" && addCombatant()} /></div>
            <div><p className="text-xs text-gray-600 mb-1">HP</p><input type="number" className={INPUT} placeholder="30" value={aMaxHp} onChange={e => setAMaxHp(e.target.value)} onKeyDown={e => e.key === "Enter" && addCombatant()} /></div>
            <div><p className="text-xs text-gray-600 mb-1">AC</p><input type="number" className={INPUT} placeholder="13" value={aAc} onChange={e => setAAc(e.target.value)} onKeyDown={e => e.key === "Enter" && addCombatant()} /></div>
            <div><p className="text-xs text-gray-600 mb-1">CR</p><input className={INPUT} placeholder="1/2" value={aCr} onChange={e => setACr(e.target.value)} onKeyDown={e => e.key === "Enter" && addCombatant()} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={addCombatant} disabled={!aName.trim()} className="bg-amber-500 text-black text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors">Add</button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-gray-500 hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {combatants.length === 0 && !showAdd && (
        <EmptyState emoji="🎲" text="No combatants" sub="Add players and enemies to start tracking initiative" />
      )}

      {/* Column headers */}
      {sorted.length > 0 && (
        <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem_7rem_1.5rem] gap-2 px-3 pb-1">
          <span className="text-xs text-gray-600 text-center">Init</span>
          <span className="text-xs text-gray-600">Name</span>
          <span className="text-xs text-gray-600 text-center">AC</span>
          <span className="text-xs text-gray-600 text-center">CR</span>
          <span className="text-xs text-gray-600 text-center">HP</span>
          <span className="text-xs text-gray-600 text-center">Damage</span>
          <span />
        </div>
      )}

      {/* Rows */}
      <div className="space-y-1.5">
        {sorted.map((c, i) => {
          const isActive = c.id === activeTurn;
          const isDead = c.hp === 0;
          const hpColor = c.hp / c.maxHp > 0.5 ? "#22c55e" : c.hp / c.maxHp > 0.25 ? "#f59e0b" : "#ef4444";
          return (
            <div key={c.id} className={`grid grid-cols-[2rem_1fr_3.5rem_3.5rem_3.5rem_7rem_1.5rem] gap-2 items-center px-3 py-2.5 rounded-xl border transition-all ${isActive ? "border-amber-500 bg-amber-500/5" : "border-[#2e2e2e] bg-[#1e1e1e]"} ${isDead ? "opacity-40" : ""}`}>
              {/* Initiative */}
              <span className={`text-xs font-bold text-center ${isActive ? "text-amber-400" : "text-gray-400"}`}>{c.initiative}</span>
              {/* Name + badges */}
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-sm font-medium truncate ${isDead ? "line-through text-gray-600" : "text-white"}`}>{c.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${c.kind === "pc" ? "bg-blue-500/20 text-blue-400" : "bg-red-500/15 text-red-400"}`}>{c.kind === "pc" ? "PC" : "E"}</span>
                {isActive && <span className="text-xs text-amber-500 shrink-0">●</span>}
              </div>
              {/* AC */}
              <span className="text-xs text-gray-300 text-center font-mono">{c.ac || "—"}</span>
              {/* CR */}
              <span className="text-xs text-gray-500 text-center">{c.cr || "—"}</span>
              {/* HP */}
              <span className="text-xs font-mono text-center" style={{ color: hpColor }}>{c.hp}/{c.maxHp}</span>
              {/* Damage input */}
              <div className="flex items-center gap-1">
                <button onClick={() => adjustHp(c.id, 1)} className="w-5 h-5 rounded bg-green-500/10 text-green-400 text-xs hover:bg-green-500/20 transition-colors leading-none">+</button>
                <input
                  type="number"
                  className="w-10 text-center bg-[#252525] border border-[#333] rounded px-1 py-0.5 text-xs text-white focus:outline-none"
                  placeholder="—"
                  value={dmgInput[c.id] ?? ""}
                  onChange={e => setDmgInput(p => ({ ...p, [c.id]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && applyDmg(c.id)}
                />
                <button onClick={() => applyDmg(c.id)} className="w-5 h-5 rounded bg-red-500/10 text-red-400 text-xs hover:bg-red-500/20 transition-colors leading-none">−</button>
              </div>
              {/* Remove */}
              <button onClick={() => { setCombatants(p => p.filter(x => x.id !== c.id)); if (turnIdx >= i && turnIdx > 0) setTurnIdx(t => t - 1); }} className="text-gray-700 hover:text-red-400 text-xs transition-colors text-center">✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const INPUT = "w-full bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-white font-semibold text-lg mb-5">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function SaveBar({ onClose, onSave, saving, disabled }: { onClose: () => void; onSave: () => void; saving: boolean; disabled?: boolean }) {
  return (
    <div className="flex gap-3 mt-6">
      <button onClick={onSave} disabled={disabled || saving} className="bg-amber-500 text-black px-5 py-2 rounded-xl text-sm font-medium hover:bg-amber-400 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Save"}</button>
      <button onClick={onClose} className="text-sm text-gray-500 hover:text-white transition-colors">Cancel</button>
    </div>
  );
}

function EmptyState({ emoji, text, sub }: { emoji: string; text: string; sub: string }) {
  return (
    <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-10 text-center">
      <p className="text-3xl mb-2">{emoji}</p>
      <p className="text-white text-sm font-medium mb-1">{text}</p>
      <p className="text-xs text-gray-600">{sub}</p>
    </div>
  );
}
