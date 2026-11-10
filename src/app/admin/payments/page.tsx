"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency, formatDate, statusBadgeClass } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const url =
        status === "ALL" ? "/api/admin/payments" : `/api/admin/payments?status=${status}`;
      const res = await fetch(url, { credentials: "include" });
      const d = await res.json().catch(() => []);
      let list: any[] = Array.isArray(d) ? d : d?.payments || [];
      if (!res.ok) {
        toast(d.error || "Failed to load payments", "err");
        list = [];
      }
      setItems(list);
      setSelected(new Set());
    } catch {
      setItems([]);
      toast("Failed to load payments", "err");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status]);

  async function review(id: string, next: "APPROVE" | "REJECT") {
    const reason =
      next === "REJECT" ? window.prompt("Reason for rejection") || "Rejected" : undefined;
    if (next === "REJECT" && reason === null) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: next,
          status: next === "APPROVE" ? "APPROVED" : "REJECTED",
          reason,
          rejectReason: reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || data.detail || "Failed", "err");
        return;
      }
      toast(next === "APPROVE" ? "Payment approved" : "Payment rejected");
      await load();
    } catch {
      toast("Network error", "err");
    } finally {
      setBusyId(null);
    }
  }

  async function bulkReview(next: "APPROVE" | "REJECT") {
    const ids = Array.from(selected);
    if (!ids.length) {
      toast("Select at least one payment", "err");
      return;
    }
    const reason =
      next === "REJECT"
        ? window.prompt("Reason for rejection (applies to all)") || "Rejected"
        : undefined;
    if (next === "REJECT" && reason === null) return;
    if (
      !window.confirm(
        `${next === "APPROVE" ? "Approve" : "Reject"} ${ids.length} selected payment(s)?`
      )
    )
      return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/payments", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: next, reason, rejectReason: reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Bulk action failed", "err");
        return;
      }
      toast(data.message || `Processed ${ids.length} payment(s)`);
      await load();
    } catch {
      toast("Network error", "err");
    } finally {
      setBulkBusy(false);
    }
  }

  const filtered = items.filter((p) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      String(p?.type || "").toLowerCase().includes(s) ||
      String(p?.userId || "").toLowerCase().includes(s) ||
      String(p?.user?.email || "").toLowerCase().includes(s) ||
      String(p?.reservation?.asset?.title || "").toLowerCase().includes(s)
    );
  });

  const allVisibleIds = filtered.map((p) => p.id);
  const allSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allVisibleIds));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Payments</h1>
      <p className="text-xs text-slate-500">
        First installment needs approval. Later installments auto-apply and notify you. Select multiple
        pending payments to approve or reject together.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search type, email, or service"
          className="flex-1 border rounded-xl px-3 min-h-[44px] text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded-xl px-3 min-h-[44px] text-sm"
        >
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="ALL">All</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 border rounded-xl p-3">
          <span className="text-sm font-medium text-slate-700">{selected.size} selected</span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkReview("APPROVE")}
            className="min-h-[40px] px-3 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            {bulkBusy ? "Working…" : "Approve selected"}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkReview("REJECT")}
            className="min-h-[40px] px-3 rounded-lg border border-red-200 text-red-700 text-sm font-semibold disabled:opacity-50"
          >
            Reject selected
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="min-h-[40px] px-3 rounded-lg text-sm text-slate-600 underline"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border rounded-2xl p-6">No payments yet.</p>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-600 px-1">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
            Select all visible
          </label>
          {filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex gap-3 min-w-0">
                <input
                  type="checkbox"
                  className="mt-1 rounded"
                  checked={selected.has(p.id)}
                  onChange={() => toggleOne(p.id)}
                  disabled={p.status !== "PENDING"}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-sm">
                    {formatCurrency(Number(p.amount))} · {p.type || "Payment"}
                    {p.method === "AUTO" ? " · auto" : ""}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {p.user?.email || p.userId}
                    {p.reservation?.asset?.title ? ` · ${p.reservation.asset.title}` : ""}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(p.createdAt)}</p>
                  <span
                    className={`inline-block mt-1 text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(
                      p.status
                    )}`}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {p.proofUrl && (
                  <a
                    href={p.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[44px] inline-flex items-center text-xs underline text-primary-600 px-2"
                  >
                    View proof
                  </a>
                )}
                {p.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => review(p.id, "APPROVE")}
                      className="min-h-[44px] px-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                    >
                      {busyId === p.id ? "…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => review(p.id, "REJECT")}
                      className="min-h-[44px] px-3 rounded-xl border border-red-200 text-red-700 text-sm font-semibold disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
