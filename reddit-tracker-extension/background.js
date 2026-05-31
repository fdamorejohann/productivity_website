// ─── Config ───────────────────────────────────────────────────────────────────
// Update this to your deployed Vercel URL
const API_BASE = "https://your-app.vercel.app/api/data/site-usage";
const TRACKED_SITE = "reddit.com";

// ─── State ────────────────────────────────────────────────────────────────────
let activeTabIsReddit = false;
let sessionStart = null; // when the current reddit session began

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Accumulate seconds into storage ─────────────────────────────────────────
async function accrue(seconds) {
  if (seconds <= 0) return;
  const date = todayStr();
  const key = `usage_${date}`;
  const result = await chrome.storage.local.get([key, "pending_visits"]);
  const current = result[key] || { seconds: 0, visits: 0 };
  const pendingVisits = result["pending_visits"] || 0;
  await chrome.storage.local.set({
    [key]: { seconds: current.seconds + seconds, visits: current.visits + pendingVisits },
    pending_visits: 0,
  });
}

// ─── Start/stop tracking ──────────────────────────────────────────────────────
function startTracking() {
  if (activeTabIsReddit) return;
  activeTabIsReddit = true;
  sessionStart = Date.now();
  // Mark a new visit
  chrome.storage.local.get("pending_visits", r => {
    chrome.storage.local.set({ pending_visits: (r.pending_visits || 0) + 1 });
  });
}

function stopTracking() {
  if (!activeTabIsReddit) return;
  activeTabIsReddit = false;
  const elapsed = Math.round((Date.now() - sessionStart) / 1000);
  sessionStart = null;
  accrue(elapsed);
}

// ─── Check if a URL is Reddit ─────────────────────────────────────────────────
function isReddit(url) {
  if (!url) return false;
  try { return new URL(url).hostname.includes("reddit.com"); } catch { return false; }
}

// ─── Tab/window event listeners ───────────────────────────────────────────────
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isReddit(tab.url)) startTracking(); else stopTracking();
  } catch { stopTracking(); }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id === tabId) {
      if (isReddit(tab.url)) startTracking(); else stopTracking();
    }
  });
});

chrome.windows.onFocusChanged.addListener(windowId => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    stopTracking();
  } else {
    chrome.tabs.query({ active: true, windowId }, tabs => {
      if (tabs[0] && isReddit(tabs[0].url)) startTracking(); else stopTracking();
    });
  }
});

// Idle detection — stop accruing if user is away
chrome.idle.setDetectionInterval(60);
chrome.idle.onStateChanged.addListener(state => {
  if (state === "idle" || state === "locked") stopTracking();
  else {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0] && isReddit(tabs[0].url)) startTracking();
    });
  }
});

// ─── Sync to API every 5 minutes ─────────────────────────────────────────────
chrome.alarms.create("sync", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== "sync") return;

  // Flush current session first
  if (activeTabIsReddit && sessionStart) {
    const elapsed = Math.round((Date.now() - sessionStart) / 1000);
    sessionStart = Date.now(); // reset timer so we don't double-count
    await accrue(elapsed);
  }

  // Sync all unsent days to API
  const all = await chrome.storage.local.get(null);
  for (const [key, val] of Object.entries(all)) {
    if (!key.startsWith("usage_")) continue;
    const date = key.replace("usage_", "");
    if (!val.seconds && !val.visits) continue;
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: TRACKED_SITE, date, seconds: val.seconds, visits: val.visits }),
      });
      if (res.ok) {
        // Remove synced entry
        await chrome.storage.local.remove(key);
      }
    } catch {
      // Network unavailable — try next time
    }
  }
});
