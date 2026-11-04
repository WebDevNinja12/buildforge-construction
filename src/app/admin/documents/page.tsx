"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { statusBadgeClass } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export default function AdminDocumentsPage() {
  const { toast } = useToast();
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function review(id: string, status: "APPROVED" | "REJECTED") {
    const rejectReason =
      status === "REJECTED" ? window.prompt("Reason") || "Rejected" : undefined;
    setBusyId(id);
    try {
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
      toast(status === "APPROVED" ? "Document approved" : "Document rejected");
      await load();
    } catch {
      toast("Network error", "err");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = docs.filter((d) => {
    if (filter !== "ALL" && d?.status !== filter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      String(d?.label || "").toLowerCase().includes(s) ||
      String(d?.type || "").toLowerCase().includes(s) ||
      String(d?.userId || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Documents</h1>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          className="flex-1 border rounded-xl px-3 min-h-[44px] text-sm"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-xl px-3 min-h-[44px] text-sm"
        >
          <option value="ALL">All</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border rounded-2xl p-6">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
            >
              <div>
                <p className="font-medium">{d?.label || d?.type}</p>
                <p className="text-xs text-slate-500">user {d?.userId}</p>
                <span
                  className={`inline-block mt-1 text-[10px] font-semibold px-2 py-1 rounded-full ${
                    statusBadgeClass(d?.status)
                  }`}
                >
                  {d?.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {d?.fileUrl && (
                  <a
                    href={d.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[44px] inline-flex items-center text-xs underline text-primary-600 px-2"
                  >
                    View
                  </a>
                )}
                {d?.status !== "APPROVED" && (
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    className="min-h-[44px] text-xs font-semibold bg-green-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    onClick={() => review(d.id, "APPROVED")}
                  >
                    Approve
                  </button>
                )}
                {d?.status !== "REJECTED" && (
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    className="min-h-[44px] text-xs font-semibold bg-red-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    onClick={() => review(d.id, "REJECTED")}
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
