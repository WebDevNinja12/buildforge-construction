"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Trash2, CheckSquare, Square } from "lucide-react";
import { formatDate } from "@/lib/utils";

function formatDetails(details: unknown): string {
  if (details == null) return "";
  if (typeof details === "string") {
    try {
      const parsed = JSON.parse(details);
      return typeof parsed === "object" ? JSON.stringify(parsed) : details;
    } catch {
      return details;
    }
  }
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/activity?limit=300", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setLogs(Array.isArray(data) ? data : data.logs || data.recentLogs || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const hay = `${l.action || ""} ${l.entity || ""} ${l.admin?.name || ""} ${formatDetails(l.details)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [logs, filter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll(on: boolean) {
    if (!on) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((l) => l.id)));
  }

  async function deleteIds(ids: string[]) {
    if (!ids.length) return;
    if (
      !window.confirm(
        `Delete ${ids.length} log entr${ids.length === 1 ? "y" : "ies"}? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/activity", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setMsg(`Deleted ${data.deleted ?? ids.length}`);
      setSelected(new Set());
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
    if (!window.confirm(`Delete activity older than ${d.toLocaleDateString()}?`)) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(
        `/api/admin/activity?before=${encodeURIComponent(d.toISOString())}`,
        { method: "DELETE", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(`Deleted ${data.deleted} older entries`);
      setSelected(new Set());
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!window.confirm("Clear ALL activity history? This cannot be undone.")) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/activity?all=1", {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(`Cleared ${data.deleted} entries`);
      setSelected(new Set());
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const allSelected = filtered.length > 0 && filtered.every((l) => selected.has(l.id));

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-construction-dark">Activity log</h1>
        <p className="text-sm text-slate-500 mt-1">
          Admin actions history. Select entries to delete, or clear older / all history.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by action, admin, entity…"
          className="flex-1 min-w-[180px] min-h-[40px] border border-slate-200 rounded-xl px-3 text-sm bg-white"
        />
        <button
          type="button"
          disabled={busy}
          onClick={clearOlderThan30}
          className="min-h-[40px] text-xs font-semibold border border-slate-200 px-3 rounded-xl hover:bg-slate-50 disabled:opacity-50"
        >
          Clear older than 30 days
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={clearAll}
          className="min-h-[40px] text-xs font-semibold bg-red-600 text-white px-3 rounded-xl inline-flex items-center gap-1 disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear all
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3">
        <button
          type="button"
          onClick={() => toggleAll(!allSelected)}
          className="text-slate-500 hover:text-primary-600"
          aria-label="Select all"
        >
          {allSelected ? (
            <CheckSquare className="w-5 h-5 text-primary-600" />
          ) : (
            <Square className="w-5 h-5" />
          )}
        </button>
        <span className="text-xs text-slate-500">{selected.size} selected</span>
        <button
          type="button"
          disabled={!selected.size || busy}
          onClick={() => deleteIds(Array.from(selected))}
          className="min-h-[36px] px-3 rounded-xl bg-red-600 text-white text-xs font-semibold disabled:opacity-40"
        >
          Delete selected
        </button>
        <button
          type="button"
          onClick={() => setSelected(new Set())}
          className="min-h-[36px] px-3 rounded-xl text-xs font-medium text-slate-500"
        >
          Clear selection
        </button>
      </div>

      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((l: any) => {
            const checked = selected.has(l.id);
            const details = formatDetails(l.details);
            return (
              <li
                key={l.id}
                className={`bg-white border rounded-xl px-4 py-3 text-sm flex gap-3 ${
                  checked ? "border-primary-300 ring-1 ring-primary-100" : "border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(l.id)}
                  className="mt-0.5 text-slate-400 hover:text-primary-600 shrink-0"
                  aria-label="Select"
                >
                  {checked ? (
                    <CheckSquare className="w-5 h-5 text-primary-600" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-construction-dark">{l.action}</p>
                  <p className="text-xs text-slate-500">
                    {l.admin?.name || l.adminId || "Admin"} · {formatDate(l.createdAt)}
                    {l.entity ? ` · ${l.entity}` : ""}
                  </p>
                  {details && (
                    <p className="text-xs text-slate-600 mt-1 break-all line-clamp-3">{details}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => deleteIds([l.id])}
                  className="text-slate-400 hover:text-red-600 shrink-0 self-start"
                  title="Delete entry"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            );
          })}
          {!filtered.length && (
            <p className="text-sm text-slate-500 py-6 text-center border border-dashed rounded-xl">
              No activity recorded yet.
            </p>
          )}
        </ul>
      )}
    </div>
  );
}
