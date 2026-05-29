import { useState } from "react";

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!pw.trim()) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (res.ok) {
        localStorage.setItem("site_authed", "1");
        onUnlock();
      } else {
        setError(true);
        setPw("");
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center p-6">
      <div className="bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl p-10 w-full max-w-sm text-center shadow-2xl">
        <div className="text-4xl mb-5">🔒</div>
        <h1 className="text-lg font-semibold text-white mb-1">Personal OS</h1>
        <p className="text-xs text-gray-600 mb-7">Enter your passcode to continue</p>
        <input
          type="password"
          className="w-full bg-[#252525] border border-[#333] rounded-xl px-4 py-3 text-white text-center text-lg tracking-widest placeholder-gray-700 focus:outline-none focus:border-gray-500 mb-3"
          placeholder="••••••"
          value={pw}
          onChange={e => { setPw(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && submit()}
          autoFocus
        />
        {error && <p className="text-xs text-red-400 mb-3">Incorrect passcode</p>}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-white text-black rounded-xl py-3 text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {loading ? "Checking…" : "Unlock"}
        </button>
      </div>
    </div>
  );
}
