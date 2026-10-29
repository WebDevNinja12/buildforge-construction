"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

type Log = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  admin?: { name: string; email: string };
};

/** Drop into admin page Activity tab */
export function AdminActivityPanel() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/activity?limit=150");
      const data = await res.json();
      if (res.ok) setLogs(data.logs || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function clearAll() {
    if (!confirm("Clear ALL activity history? This cannot be undone.")) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/activity?all=1", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(`Cleared ${data.deleted} entries`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearOlderThan30() {
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
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(id: string) {
    if (!confirm("Delete this log entry?")) return;
    await fetch(`/api/admin/activity?id=${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <h2 className="font-semibold text-construction-dark">Activity history</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={clearOlderThan30}
            className="text-xs font-semibold border px-3 py-1.5 rounded-lg hover:bg-slate-50"
          >
            Clear older than 30 days
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={clearAll}
            className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear all history
          </button>
        </div>
      </div>
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
      <div className="bg-white border rounded-xl divide-y max-h-[480px] overflow-y-auto">
        {logs.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No activity recorded.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="px-4 py-3 flex gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-construction-dark">{log.action}</p>
                <p className="text-xs text-slate-500">
                  {log.admin?.name || "Admin"} · {log.entity || "—"}
                  {log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ""}
                </p>
                {log.details && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{log.details}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteOne(log.id)}
                className="text-slate-400 hover:text-red-600 shrink-0"
                title="Delete entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
