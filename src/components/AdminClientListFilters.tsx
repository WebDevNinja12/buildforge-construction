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

function statusColor(s?: string) {
  const v = (s || "").toUpperCase();
  if (["APPROVED", "VERIFIED", "ACTIVE", "PAID", "COMPLETED"].includes(v))
    return "bg-emerald-100 text-emerald-800";
  if (["PENDING", "UNDER_REVIEW", "INCOMPLETE"].includes(v)) return "bg-amber-100 text-amber-800";
  if (["REJECTED", "SUSPENDED", "CANCELLED", "EXPIRED", "OVERDUE"].includes(v))
    return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

export function AdminClientPayments({ payments }: { payments: any[] }) {
  const [filter, setFilter] = useState("ALL");
  const list = useMemo(() => {
    if (filter === "ALL") return payments || [];
    return (payments || []).filter((p) => String(p.status || "").toUpperCase() === filter);
  }, [payments, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter</span>
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`min-h-[36px] px-3 rounded-full text-xs font-semibold ${
              filter === s
                ? "bg-construction-dark text-white"
                : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-auto">
          {list.length} payment{list.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="space-y-2">
        {list.map((p: any) => (
          <div
            key={p.id}
            className="border border-slate-200 rounded-2xl p-3 bg-white text-sm flex flex-wrap justify-between gap-2"
          >
            <div>
              <p className="font-semibold">₦{Number(p.amount || 0).toLocaleString("en-NG")}</p>
              <p className="text-xs text-slate-500">
                {p.method || "—"} · {formatDate(p.createdAt)}
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full h-fit ${statusColor(p.status)}`}>
              {p.status}
            </span>
          </div>
        ))}
        {!list.length && <p className="text-slate-500 text-sm">No payments for this filter.</p>}
      </div>
    </div>
  );
}

export function AdminClientReservations({ reservations }: { reservations: any[] }) {
  const [filter, setFilter] = useState("ALL");
  const list = useMemo(() => {
    if (filter === "ALL") return reservations || [];
    return (reservations || []).filter((r) => String(r.status || "").toUpperCase() === filter);
  }, [reservations, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filter</span>
        {["ALL", "ACTIVE", "PENDING", "EXPIRED", "CANCELLED", "COMPLETED"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`min-h-[36px] px-3 rounded-full text-xs font-semibold ${
              filter === s
                ? "bg-construction-dark text-white"
                : "bg-white border border-slate-200 text-slate-600"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {list.map((r: any) => (
          <div key={r.id} className="border border-slate-200 rounded-2xl p-4 bg-white text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold text-construction-dark">{r.asset?.title || "Asset"}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>
                {r.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {r.paymentType || "—"} · expires {formatDate(r.expiresAt)}
            </p>
          </div>
        ))}
        {!list.length && <p className="text-slate-500 text-sm">No reservations for this filter.</p>}
      </div>
    </div>
  );
}
