"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  FileText,
  User,
  Mail,
  Phone,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
} from "lucide-react";
import { statusBadgeClass } from "@/lib/utils";
import { useToast } from "@/components/Toast";

type DocRow = {
  id: string;
  userId: string;
  type?: string;
  label?: string;
  status?: string;
  fileUrl?: string;
  fileName?: string;
  rejectReason?: string;
  source?: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    phone?: string | null;
    status?: string;
  } | null;
};

type ClientGroup = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  docs: DocRow[];
  pending: number;
  approved: number;
  rejected: number;
};

export default function AdminDocumentsPage() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/installment-docs", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setDocs(data?.documents || (Array.isArray(data) ? data : []));
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function review(id: string, status: "APPROVED" | "REJECTED", source?: string) {
    const rejectReason =
      status === "REJECTED" ? window.prompt("Reason for rejection") || "Rejected" : undefined;
    setBusyId(id);
    try {
      if (source === "REGISTRATION") {
        const doc = docs.find((d) => d.id === id);
        if (!doc?.userId) throw new Error("Missing client");
        const res = await fetch(`/api/admin/clients/${doc.userId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "REVIEW_DOCS",
            reviews: [{ id, status, rejectReason }],
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          toast(d.error || "Failed", "err");
          return;
        }
      } else {
        const res = await fetch("/api/installment-docs/review", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            status,
            action: status === "APPROVED" ? "APPROVE" : "REJECT",
            rejectReason,
            reason: rejectReason,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          toast(d.error || "Failed", "err");
          return;
        }
      }
      toast(status === "APPROVED" ? "Document approved" : "Document rejected");
      await load();
    } catch {
      toast("Network error", "err");
    } finally {
      setBusyId(null);
    }
  }

  const groups: ClientGroup[] = useMemo(() => {
    const map = new Map<string, ClientGroup>();
    for (const d of docs) {
      if (filter !== "ALL" && d.status !== filter) continue;
      const name = d.user?.name || "";
      const email = d.user?.email || "";
      const hay = `${d.label || ""} ${d.type || ""} ${d.userId} ${name} ${email}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) continue;
      const uid = d.userId || "unknown";
      if (!map.has(uid)) {
        map.set(uid, {
          userId: uid,
          name: name || "Unknown client",
          email: email || "—",
          phone: d.user?.phone || "—",
          docs: [],
          pending: 0,
          approved: 0,
          rejected: 0,
        });
      }
      const g = map.get(uid)!;
      g.docs.push(d);
      const st = String(d.status || "").toUpperCase();
      if (st === "APPROVED") g.approved += 1;
      else if (st === "REJECTED") g.rejected += 1;
      else g.pending += 1;
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      return a.name.localeCompare(b.name);
    });
  }, [docs, filter, q]);

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (g.pending > 0 && next[g.userId] === undefined) next[g.userId] = true;
      }
      return next;
    });
  }, [groups]);

  return (
    <div className="space-y-5 max-w-4xl pb-10">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
          <FileText className="w-3.5 h-3.5 text-primary-600" />
          Review
        </div>
        <h1 className="text-2xl font-bold text-construction-dark tracking-tight">Documents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Grouped by client. Approve or reject registration and installment files.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search client, email, or document…"
            className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm min-h-[44px] bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm min-h-[44px] bg-white sm:w-48"
        >
          <option value="ALL">All statuses</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
          No documents match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const isOpen = open[g.userId] ?? g.pending > 0;
            return (
              <div
                key={g.userId}
                className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [g.userId]: !isOpen }))}
                  className="w-full text-left px-4 sm:px-5 py-4 flex items-start gap-3 hover:bg-slate-50/80 transition"
                >
                  <span className="mt-1 text-slate-400">
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </span>
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 text-slate-600 shrink-0">
                    <User className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-construction-dark truncate">{g.name}</p>
                      {g.pending > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {g.pending} pending
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3" />
                        {g.email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {g.phone}
                      </span>
                      <span>
                        {g.docs.length} file{g.docs.length === 1 ? "" : "s"} · {g.approved} approved
                        {g.rejected ? ` · ${g.rejected} rejected` : ""}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/admin/clients/${g.userId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-xs font-semibold text-primary-700 hover:underline inline-flex items-center gap-1 min-h-[36px]"
                  >
                    Profile
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/40 px-4 sm:px-5 py-3 space-y-2">
                    {g.docs.map((d) => {
                      const label = d.label || d.type || "Document";
                      const st = String(d.status || "PENDING");
                      return (
                        <div
                          key={d.id}
                          className="bg-white border border-slate-200 rounded-xl px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-sm text-construction-dark">{label}</p>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusBadgeClass(st)}`}
                              >
                                {st.replace(/_/g, " ")}
                              </span>
                              {d.source === "REGISTRATION" && (
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                  Registration
                                </span>
                              )}
                            </div>
                            {d.fileName && (
                              <p className="text-xs text-slate-400 mt-0.5 truncate">{d.fileName}</p>
                            )}
                            {d.rejectReason && (
                              <p className="text-xs text-red-600 mt-1">{d.rejectReason}</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {d.fileUrl ? (
                              <a
                                href={d.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-semibold text-primary-700 hover:underline px-2 py-1.5"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400 px-2">No file</span>
                            )}
                            {st !== "APPROVED" && (
                              <button
                                type="button"
                                disabled={busyId === d.id}
                                onClick={() => review(d.id, "APPROVED", d.source)}
                                className="min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
                              >
                                {busyId === d.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  "Approve"
                                )}
                              </button>
                            )}
                            {st !== "REJECTED" && (
                              <button
                                type="button"
                                disabled={busyId === d.id}
                                onClick={() => review(d.id, "REJECTED", d.source)}
                                className="min-h-[36px] px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
