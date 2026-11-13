"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, CheckSquare, Square, Trash2, XCircle, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDate, statusBadgeClass } from "@/lib/utils";
import { useToast } from "@/components/Toast";

type RefundMode = "FULL" | "DEDUCT_10";

export default function AdminReservationsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelIds, setCancelIds] = useState<string[]>([]);
  const [cancelReason, setCancelReason] = useState("");
  const [refundMode, setRefundMode] = useState<RefundMode>("DEDUCT_10");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reservations", { credentials: "include" });
      if (!res.ok) {
        const res2 = await fetch("/api/reservations", { credentials: "include" });
        const data = await res2.json().catch(() => []);
        setItems(Array.isArray(data) ? data : []);
      } else {
        const data = await res.json().catch(() => []);
        setItems(Array.isArray(data) ? data : data?.reservations || []);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((r) => {
      const st = String(r.status || "").toUpperCase();
      if (filter !== "ALL" && st !== filter) return false;
      if (!query) return true;
      const hay = `${r.asset?.title || ""} ${r.user?.email || ""} ${r.user?.name || ""} ${r.paymentType || ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [items, q, filter]);

  const activeItems = useMemo(
    () =>
      filtered.filter((r) =>
        ["PENDING", "CONFIRMED", "ACTIVE"].includes(String(r.status || "").toUpperCase())
      ),
    [filtered]
  );
  const historyItems = useMemo(
    () =>
      filtered.filter(
        (r) =>
          !["PENDING", "CONFIRMED", "ACTIVE"].includes(String(r.status || "").toUpperCase())
      ),
    [filtered]
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleMany(list: any[], on: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      for (const r of list) {
        if (on) n.add(r.id);
        else n.delete(r.id);
      }
      return n;
    });
  }

  function openCancel(ids: string[]) {
    setCancelIds(ids);
    setCancelReason("");
    setRefundMode("DEDUCT_10");
    setCancelOpen(true);
  }

  async function submitCancel() {
    if (!cancelIds.length) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: cancelIds,
          action: "CANCEL",
          reason: cancelReason.trim() || "Cancelled by admin",
          refundMode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || data.detail || "Cancel failed", "err");
        return;
      }
      toast(data.message || "Cancelled");
      setCancelOpen(false);
      setSelected(new Set());
      await load();
    } catch {
      toast("Network error", "err");
    } finally {
      setBusy(false);
    }
  }

  async function acceptOne(id: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "ACCEPT" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Accept failed", "err");
        return;
      }
      toast("Accepted");
      await load();
    } catch {
      toast("Network error", "err");
    } finally {
      setBusy(false);
    }
  }

  async function cleanupSelected() {
    const ids = Array.from(selected).filter((id) => {
      const r = items.find((x) => x.id === id);
      const st = String(r?.status || "").toUpperCase();
      return ["CANCELLED", "EXPIRED", "REJECTED", "FULLY_PAID", "COMPLETED"].includes(st);
    });
    if (!ids.length) {
      toast("Select cancelled / completed / expired items only", "err");
      return;
    }
    if (
      !window.confirm(
        `Permanently remove ${ids.length} history record(s)? This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "CLEANUP" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "Cleanup failed", "err");
        return;
      }
      toast(data.message || "History cleaned");
      setSelected(new Set());
      await load();
    } catch {
      toast("Network error", "err");
    } finally {
      setBusy(false);
    }
  }

  function paidAmount(r: any) {
    const fromPayments = (r.payments || [])
      .filter((p: any) => ["APPROVED", "COMPLETED", "CONFIRMED"].includes(String(p.status)))
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    return Math.max(fromPayments, Number(r.installmentPaid || 0));
  }

  function Card({ r }: { r: any }) {
    const st = String(r.status || "").toUpperCase();
    const isActive = ["PENDING", "CONFIRMED", "ACTIVE"].includes(st);
    const checked = selected.has(r.id);
    const paid = paidAmount(r);

    return (
      <div
        className={`bg-white border rounded-2xl p-4 shadow-sm transition ${
          checked ? "border-primary-300 ring-1 ring-primary-100" : "border-slate-200"
        }`}
      >
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => toggle(r.id)}
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
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-construction-dark">
                  {r.asset?.title || "Service"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {r.user?.email || r.user?.name || "Client"}
                  {" · "}
                  {formatCurrency(Number(r.installmentTotal || r.asset?.price || 0))}
                  {r.paymentType ? ` · ${r.paymentType}` : ""}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {formatDate(r.createdAt)}
                  {r.expiresAt ? ` · expires ${formatDate(r.expiresAt)}` : ""}
                  {paid > 0 ? ` · paid ${formatCurrency(paid)}` : ""}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(st)}`}
              >
                {st.replace(/_/g, " ")}
              </span>
            </div>

            {r.cancelReason && (
              <p className="text-xs text-red-600 mt-2 break-words">Cancel: {r.cancelReason}</p>
            )}

            <div className="flex flex-wrap gap-2 mt-3">
              {st === "PENDING" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => acceptOne(r.id)}
                  className="min-h-[36px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                  Accept
                </button>
              )}
              {isActive && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => openCancel([r.id])}
                  className="min-h-[36px] px-3 rounded-xl border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5 inline mr-1" />
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-construction-dark">Reservations</h1>
        <p className="text-sm text-slate-500 mt-1">
          Accept pending holds, cancel with full refund or 10% deduction, or clean up history.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search service or client"
          className="flex-1 min-w-[200px] min-h-[44px] border border-slate-200 rounded-xl px-3 text-sm bg-white"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="min-h-[44px] border border-slate-200 rounded-xl px-3 text-sm bg-white"
        >
          {[
            "ALL",
            "PENDING",
            "CONFIRMED",
            "ACTIVE",
            "FULLY_PAID",
            "CANCELLED",
            "EXPIRED",
            "COMPLETED",
          ].map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All statuses" : s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-3">
        <span className="text-xs text-slate-500">{selected.size} selected</span>
        <button
          type="button"
          disabled={!selected.size || busy}
          onClick={() => {
            const ids = Array.from(selected).filter((id) => {
              const r = items.find((x) => x.id === id);
              return ["PENDING", "CONFIRMED", "ACTIVE"].includes(
                String(r?.status || "").toUpperCase()
              );
            });
            if (!ids.length) {
              toast("Select active/pending items to cancel", "err");
              return;
            }
            openCancel(ids);
          }}
          className="min-h-[36px] px-3 rounded-xl bg-red-600 text-white text-xs font-semibold disabled:opacity-40"
        >
          Cancel selected
        </button>
        <button
          type="button"
          disabled={!selected.size || busy}
          onClick={cleanupSelected}
          className="min-h-[36px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5 inline mr-1" />
          Clean history
        </button>
        <button
          type="button"
          onClick={() => setSelected(new Set())}
          className="min-h-[36px] px-3 rounded-xl text-xs font-medium text-slate-500"
        >
          Clear selection
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Active ({activeItems.length})
              </h2>
              <button
                type="button"
                className="text-xs font-semibold text-primary-700"
                onClick={() =>
                  toggleMany(activeItems, !activeItems.every((r) => selected.has(r.id)))
                }
              >
                {activeItems.length && activeItems.every((r) => selected.has(r.id))
                  ? "Deselect all"
                  : "Select all active"}
              </button>
            </div>
            <div className="space-y-2">
              {activeItems.map((r) => (
                <Card key={r.id} r={r} />
              ))}
              {!activeItems.length && (
                <p className="text-sm text-slate-400 py-4 text-center border border-dashed rounded-2xl">
                  No active reservations
                </p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                History ({historyItems.length})
              </h2>
              <button
                type="button"
                className="text-xs font-semibold text-primary-700"
                onClick={() =>
                  toggleMany(historyItems, !historyItems.every((r) => selected.has(r.id)))
                }
              >
                {historyItems.length && historyItems.every((r) => selected.has(r.id))
                  ? "Deselect all"
                  : "Select all history"}
              </button>
            </div>
            <div className="space-y-2">
              {historyItems.map((r) => (
                <Card key={r.id} r={r} />
              ))}
              {!historyItems.length && (
                <p className="text-sm text-slate-400 py-4 text-center border border-dashed rounded-2xl">
                  No history records
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {cancelOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-construction-dark">
              Cancel {cancelIds.length > 1 ? `${cancelIds.length} plans` : "plan"}
            </h3>
            <p className="text-sm text-slate-500">
              Choose refund handling for any money already paid. Refunds process within 7 days.
            </p>

            <div className="space-y-2">
              <label className="flex items-start gap-3 border rounded-xl p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="refund"
                  checked={refundMode === "FULL"}
                  onChange={() => setRefundMode("FULL")}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold">Full refund</span>
                  <span className="text-xs text-slate-500">
                    Return 100% of approved payments — no deduction.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 border rounded-xl p-3 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="refund"
                  checked={refundMode === "DEDUCT_10"}
                  onChange={() => setRefundMode("DEDUCT_10")}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold">10% deduction</span>
                  <span className="text-xs text-slate-500">
                    Keep 10% as cancellation fee; refund the remaining 90%.
                  </span>
                </span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Reason (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                placeholder="e.g. Client request, policy breach…"
              />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelOpen(false)}
                className="min-h-[40px] px-4 rounded-xl border text-sm font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitCancel}
                className="min-h-[40px] px-4 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Cancelling…" : "Confirm cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
