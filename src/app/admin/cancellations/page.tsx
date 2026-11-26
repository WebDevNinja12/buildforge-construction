"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  RotateCcw,
  CheckSquare,
  Square,
  Banknote,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { REFUND_DAYS } from "@/lib/booking-rules";

type Row = {
  id: string;
  status: string;
  cancelReason?: string | null;
  totalAmount?: number | null;
  amountPaid?: number | null;
  createdAt?: string;
  updatedAt?: string;
  asset?: { title?: string; type?: string } | null;
  user?: { id?: string; name?: string; email?: string } | null;
  payments?: { id: string; amount: number; status: string; method?: string }[];
};

function parseRefundFromReason(reason?: string | null) {
  const text = reason || "";
  const mode = /full refund|100%/i.test(text)
    ? "FULL"
    : /10%|90%/i.test(text)
      ? "DEDUCT_10"
      : "—";
  const refundMatch = text.match(/refund\s*([\d,]+)/i);
  const paidMatch = text.match(/Paid\s*([\d,]+)/i);
  const refundAmount = refundMatch
    ? Number(String(refundMatch[1]).replace(/,/g, ""))
    : null;
  const paidAmount = paidMatch
    ? Number(String(paidMatch[1]).replace(/,/g, ""))
    : null;
  const processed = /refund processed|marked refunded/i.test(text);
  return { mode, refundAmount, paidAmount, processed };
}

export default function AdminCancellationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"ALL" | "PENDING_REFUND" | "PROCESSED">("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/reservations", { credentials: "include" });
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      setRows(
        list.filter((r: Row) =>
          ["CANCELLED", "REJECTED", "EXPIRED"].includes(String(r.status || "").toUpperCase())
        )
      );
      setSelected(new Set());
    } catch {
      setRows([]);
      setErr("Failed to load cancellations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enriched = useMemo(() => {
    return rows.map((r) => {
      const meta = parseRefundFromReason(r.cancelReason);
      const paidFromPayments = (r.payments || [])
        .filter((p) => ["APPROVED", "COMPLETED", "CONFIRMED"].includes(String(p.status)))
        .reduce((s, p) => s + Number(p.amount || 0), 0);
      const paid = meta.paidAmount ?? (Number(r.amountPaid || 0) || paidFromPayments);
      const refund =
        meta.refundAmount ??
        (meta.mode === "FULL"
          ? paid
          : meta.mode === "DEDUCT_10"
            ? Math.round(paid * 0.9)
            : paid);
      return { ...r, meta, paid, refund };
    });
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === "PENDING_REFUND") {
      return enriched.filter((r) => r.paid > 0 && !r.meta.processed);
    }
    if (filter === "PROCESSED") {
      return enriched.filter((r) => r.meta.processed);
    }
    return enriched;
  }, [enriched, filter]);

  const allIds = visible.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  async function markRefunded() {
    const ids = [...selected];
    if (!ids.length) {
      setErr("Select at least one cancelled plan");
      return;
    }
    if (
      !confirm(
        "Mark refund processed for " +
          ids.length +
          " item(s)? (typically within " +
          REFUND_DAYS +
          " days)"
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg("");
    setErr("");
    try {
      let ok = 0;
      for (const id of ids) {
        const row = rows.find((r) => r.id === id);
        const note =
          (row?.cancelReason || "Cancelled") +
          "\n[Refund processed " +
          new Date().toISOString().slice(0, 10) +
          "]";
        const res = await fetch("/api/admin/reservations", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "MARK_REFUND",
            id,
            reason: note.slice(0, 900),
          }),
        });
        if (res.ok) ok++;
      }
      setMsg("Marked " + ok + " of " + ids.length + " refund(s) as processed");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function cleanupSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    if (
      !confirm(
        "Remove " +
          ids.length +
          " cancelled record(s) from history? This cannot be undone."
      )
    )
      return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CLEANUP", ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Cleanup failed");
      setMsg("Cleaned " + (data.okCount ?? ids.length) + " record(s)");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Cleanup failed");
    } finally {
      setBusy(false);
    }
  }

  const pendingRefundCount = enriched.filter((r) => r.paid > 0 && !r.meta.processed).length;

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-construction-dark flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-primary-600" />
            Cancellations & refunds
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Cancel active plans from{" "}
            <Link href="/admin/reservations" className="text-primary-700 font-semibold underline">
              Reservations
            </Link>{" "}
            (full refund or 10% deduction). Refunds are expected within {REFUND_DAYS} days. Track and
            clear them here.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 min-h-[40px] px-3 rounded-xl border bg-white text-sm font-semibold text-slate-700"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Cancelled / expired</p>
          <p className="text-2xl font-bold text-construction-dark mt-1">{enriched.length}</p>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Awaiting refund mark</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{pendingRefundCount}</p>
        </div>
        <div className="bg-white border rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-400">Policy</p>
          <p className="text-sm text-slate-600 mt-1">
            Default cancel: 10% deduction · Refund window: {REFUND_DAYS} days · Bank transfer
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(
          [
            ["ALL", "All"],
            ["PENDING_REFUND", "Pending refund"],
            ["PROCESSED", "Refund processed"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={
              filter === id
                ? "text-xs font-semibold px-3 min-h-[36px] rounded-full border bg-primary-600 text-white border-primary-600"
                : "text-xs font-semibold px-3 min-h-[36px] rounded-full border bg-white text-slate-600"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          {msg}
        </p>
      )}
      {err && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {err}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-14 border border-dashed rounded-2xl bg-white text-slate-500 text-sm">
          No cancelled items in this filter.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={toggleAll}
              className="min-h-[40px] inline-flex items-center gap-2 font-semibold text-construction-dark"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-primary-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {allSelected ? "Unselect all" : "Select all"}
            </button>
            <span className="text-slate-500">
              {selected.size} of {visible.length} selected
            </span>
            {selected.size > 0 && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={markRefunded}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Mark refund processed
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={cleanupSelected}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-red-200 text-red-700 text-xs font-semibold disabled:opacity-50"
                >
                  Clean up history
                </button>
              </>
            )}
          </div>

          <div className="grid gap-3">
            {visible.map((r) => {
              const on = selected.has(r.id);
              const cardClass = on
                ? "bg-white border rounded-2xl p-4 flex gap-3 shadow-sm ring-2 ring-primary-500 border-primary-300"
                : "bg-white border rounded-2xl p-4 flex gap-3 shadow-sm";
              return (
                <div key={r.id} className={cardClass}>
                  <button
                    type="button"
                    className="shrink-0 mt-1 min-h-[44px] min-w-[44px] flex items-start justify-center"
                    onClick={() => toggleOne(r.id)}
                    aria-label={on ? "Unselect" : "Select"}
                  >
                    {on ? (
                      <CheckSquare className="w-5 h-5 text-primary-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-construction-dark truncate">
                        {r.asset?.title || "Plan"} · {r.asset?.type || "—"}
                      </p>
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {r.status}
                      </span>
                      {r.meta.processed ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800">
                          Refund marked
                        </span>
                      ) : r.paid > 0 ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                          Refund pending
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">
                      {r.user?.name || "Client"} · {r.user?.email || "—"}
                      {r.user?.id ? (
                        <>
                          {" · "}
                          <Link
                            href={"/admin/clients/" + r.user.id}
                            className="text-primary-700 font-medium inline-flex items-center gap-0.5"
                          >
                            Profile <ExternalLink className="w-3 h-3" />
                          </Link>
                        </>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-600">
                      Paid {formatCurrency(r.paid)} · Expected refund{" "}
                      <strong>{formatCurrency(r.refund)}</strong>
                      {r.meta.mode !== "—"
                        ? r.meta.mode === "FULL"
                          ? " (full)"
                          : " (10% deduct)"
                        : ""}
                    </p>
                    {r.cancelReason && (
                      <p className="text-xs text-slate-500 line-clamp-2 whitespace-pre-wrap">
                        {r.cancelReason}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
