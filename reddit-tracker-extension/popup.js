function fmtTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function render() {
  const all = await chrome.storage.local.get(null);
  const todayKey = `usage_${todayStr()}`;
  const todayData = all[todayKey] || { seconds: 0, visits: 0 };

  // Get yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = `usage_${yesterday.toISOString().slice(0, 10)}`;
  const yData = all[yKey] || { seconds: 0, visits: 0 };

  // Check if currently on reddit
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const onReddit = tabs[0]?.url?.includes("reddit.com");

  const el = document.getElementById("content");
  el.innerHTML = `
    ${onReddit ? `<div class="live"><div class="dot"></div> Tracking now</div>` : ""}
    <div class="row" style="margin-top:${onReddit ? "10px" : "0"}">
      <span class="label">Today</span>
      <span class="value">${fmtTime(todayData.seconds)}</span>
    </div>
    <div class="row">
      <span class="label">Visits today</span>
      <span class="value">${todayData.visits}</span>
    </div>
    <div class="row" style="margin-top:8px; border-top: 1px solid #1f2937; padding-top:8px">
      <span class="label">Yesterday</span>
      <span class="value">${fmtTime(yData.seconds)}</span>
    </div>
    <div class="muted">Syncs to dashboard every 5 min</div>
  `;
}

render();
