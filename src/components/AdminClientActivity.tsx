"use client";

import { useMemo, useState } from "react";

function formatDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

export function AdminClientActivity({ activity }: { activity: any[] }) {
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const a of activity || []) {
      if (a?.action) set.add(String(a.action));
    }
    return Array.from(set).sort();
  }, [activity]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (activity || []).filter((a) => {
      if (filter !== "ALL" && String(a.action) !== filter) return false;
      if (!q) return true;
      const details =
        typeof a.details === "string" ? a.details : JSON.stringify(a.details || "");
      const hay = `${a.action || ""} ${a.adminEmail || ""} ${a.adminName || ""} ${details} ${a.entity || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activity, filter, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Action type
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full min-h-[40px] border border-slate-200 rounded-xl px-3 text-sm bg-white"
          >
            <option value="ALL">All actions</option>
            {types.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-[2] min-w-[180px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            Search
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Admin, details, entity…"
            className="w-full min-h-[40px] border border-slate-200 rounded-xl px-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setFilter("ALL");
            setQuery("");
          }}
          className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <p className="text-xs text-slate-500">
        Showing {filtered.length} of {(activity || []).length} event
        {(activity || []).length === 1 ? "" : "s"}
      </p>

      <ul className="space-y-2">
        {filtered.map((a: any) => (
          <li
            key={a.id}
            className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-construction-dark">
                {(a.action || "EVENT").replace(/_/g, " ")}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {a.adminName || a.adminEmail || "System"}
                {a.entity ? ` · ${a.entity}` : ""}
                {a.entityId ? ` · ${String(a.entityId).slice(0, 12)}` : ""}
              </p>
              {a.details && (
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 break-all">
                  {typeof a.details === "string" ? a.details : JSON.stringify(a.details)}
                </p>
              )}
            </div>
            <time className="text-[11px] font-medium text-slate-400 shrink-0">
              {formatDate(a.createdAt)}
            </time>
          </li>
        ))}
      </ul>

      {!filtered.length && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No activity matches this filter.
        </div>
      )}
    </div>
  );
}
