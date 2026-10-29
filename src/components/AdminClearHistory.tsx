"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";

export function AdminClearHistory({ onCleared }: { onCleared?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function clearAll() {
    if (!confirm("Clear ALL admin activity history? This cannot be undone.")) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/activity?all=1", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(`Cleared ${data.deleted} log entries`);
      onCleared?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function clear30() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    if (!confirm(`Delete activity older than ${d.toLocaleDateString()}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/activity?before=${encodeURIComponent(d.toISOString())}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(`Deleted ${data.deleted} older entries`);
      onCleared?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div>
        <p className="font-semibold text-sm text-construction-dark">Clean history</p>
        <p className="text-xs text-slate-500">Remove admin activity log entries</p>
        {msg && <p className="text-xs text-slate-600 mt-1">{msg}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={clear30}
          className="text-xs font-semibold border px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          Clear older than 30 days
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={clearAll}
          className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Clear all history
        </button>
      </div>
    </div>
  );
}
