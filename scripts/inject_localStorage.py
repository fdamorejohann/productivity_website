"""
inject_localStorage.py — writes data directly into the Weekly Goals Tauri app's WebKit localStorage.

Use this ONLY for one-time data transfers (e.g. migrating from browser to app).
Data persists across normal app updates automatically — you do NOT need to run this on every publish.

Usage:
  1. Export your data from the browser devtools console:
       const keys = Object.keys(localStorage).filter(k => k.startsWith("wg_"));
       const out = {};
       keys.forEach(k => out[k] = localStorage.getItem(k));
       console.log(JSON.stringify(out));

  2. Save the JSON output to a file, e.g. ~/Desktop/wg_export.json

  3. Quit the Weekly Goals app completely (Cmd+Q)

  4. Run: python3 scripts/inject_localStorage.py ~/Desktop/wg_export.json

Storage location:
  ~/Library/WebKit/com.finndamorejohann.weeklygoals/WebsiteData/Default/
  {hash}/{hash}/LocalStorage/localstorage.sqlite3

  Values are stored as UTF-16 LE blobs (WebKit requirement).
"""

import sqlite3, json, sys, glob, os

DB_GLOB = os.path.expanduser(
    "~/Library/WebKit/com.finndamorejohann.weeklygoals/WebsiteData/Default/*/*/LocalStorage/localstorage.sqlite3"
)

def find_db():
    matches = glob.glob(DB_GLOB)
    if not matches:
        print("ERROR: Could not find the app's localStorage database.")
        print("Make sure the app has been opened at least once before running this script.")
        sys.exit(1)
    return matches[0]

def inject(data: dict):
    db_path = find_db()
    wal = db_path + "-wal"
    shm = db_path + "-shm"
    if os.path.exists(wal): os.remove(wal)
    if os.path.exists(shm): os.remove(shm)

    con = sqlite3.connect(db_path)
    cur = con.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS ItemTable (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB NOT NULL ON CONFLICT FAIL)")
    for key, value in data.items():
        cur.execute("INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)", (key, value.encode("utf-16-le")))
    con.commit()

    rows = con.execute("SELECT key, length(value) FROM ItemTable").fetchall()
    con.close()

    print(f"Wrote {len(data)} keys to:\n  {db_path}\n")
    for k, size in rows:
        print(f"  {k}: {size} bytes")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/inject_localStorage.py <path_to_wg_export.json>")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        data = json.load(f)

    inject(data)
    print("\nDone. Open the app to verify.")
