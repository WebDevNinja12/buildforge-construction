"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  MessageSquare,
  Mail,
  Phone,
  MapPin,
  Search,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ExpandableText } from "@/components/ExpandableText";

type Quote = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  projectType?: string | null;
  location?: string | null;
  budgetRange?: string | null;
  timeline?: string | null;
  description?: string | null;
  status: string;
  createdAt: string;
};

const STATUSES = ["NEW", "CONTACTED", "QUOTED", "CLOSED"] as const;

function statusStyle(s: string) {
  switch (s) {
    case "NEW":
      return "bg-amber-100 text-amber-900";
    case "CONTACTED":
      return "bg-sky-100 text-sky-900";
    case "QUOTED":
      return "bg-violet-100 text-violet-900";
    case "CLOSED":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function AdminQuotesPage() {
  const [list, setList] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/quotes", { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setList([]);
        setErr((data && data.error) || "Failed to load quotes");
        return;
      }
      setList(Array.isArray(data) ? data : data?.quotes || data?.requests || []);
    } catch {
      setList([]);
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/quotes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || "Update failed");
        return;
      }
      await load();
    } catch {
      setErr("Network error");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    return list.filter((item) => {
      if (filter !== "ALL" && item.status !== filter) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        item.name?.toLowerCase().includes(s) ||
        item.email?.toLowerCase().includes(s) ||
        item.phone?.toLowerCase().includes(s) ||
        item.projectType?.toLowerCase().includes(s) ||
        item.location?.toLowerCase().includes(s) ||
        item.description?.toLowerCase().includes(s)
      );
    });
  }, [list, filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: list.length };
    for (const s of STATUSES) c[s] = list.filter((x) => x.status === s).length;
    return c;
  }, [list]);

  return (
    <div className="max-w-5xl pb-12 space-y-5">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
          <MessageSquare className="w-3.5 h-3.5 text-primary-600" />
          Enquiries
        </div>
        <h1 className="text-2xl font-bold text-construction-dark tracking-tight">
          Quote requests
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review client project enquiries and update pipeline status.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ALL", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`min-h-[36px] px-3 rounded-full text-xs font-semibold border transition ${
              filter === s
                ? "bg-construction-dark text-white border-construction-dark"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}{" "}
            <span className="opacity-70">({counts[s] || 0})</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email, project, location…"
          className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm min-h-[44px] bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400"
        />
      </div>

      {err && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {err}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
          {list.length === 0
            ? "No quote requests yet."
            : "No requests match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="px-4 sm:px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-construction-dark">
                        {item.name}
                      </h2>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusStyle(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={busyId === item.id || item.status === s}
                        onClick={() => setStatus(item.id, s)}
                        className={`text-[10px] font-semibold uppercase tracking-wide min-h-[32px] px-2.5 rounded-lg border transition disabled:opacity-40 ${
                          item.status === s
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {busyId === item.id && item.status !== s ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          s
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <a
                    href={`mailto:${item.email}`}
                    className="inline-flex items-center gap-1.5 text-primary-700 hover:underline min-w-0"
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{item.email}</span>
                  </a>
                  {item.phone ? (
                    <a
                      href={`tel:${item.phone}`}
                      className="inline-flex items-center gap-1.5 text-primary-700 hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {item.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400 text-xs">No phone</span>
                  )}
                  <p className="text-slate-700">
                    <span className="text-slate-500">Type:</span>{" "}
                    <strong>{item.projectType || "—"}</strong>
                  </p>
                  <p className="inline-flex items-center gap-1 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {item.location || "—"}
                  </p>
                  {(item.budgetRange || item.timeline) && (
                    <p className="sm:col-span-2 text-xs text-slate-500">
                      {item.budgetRange && <>Budget: {item.budgetRange}</>}
                      {item.budgetRange && item.timeline && " · "}
                      {item.timeline && <>Timeline: {item.timeline}</>}
                    </p>
                  )}
                </div>

                {item.description && (
                  <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 px-3.5 py-3">
                    <ExpandableText text={item.description} label="Description" limit={160} />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
