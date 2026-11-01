"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency, formatDate, statusBadgeClass } from "@/lib/utils";

export default function AdminReservationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reservations", { credentials: "include" });
        const data = await res.json().catch(() => []);
        setItems(Array.isArray(data) ? data : []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter((r) => {
    if (filter !== "ALL" && r?.status !== filter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      r?.asset?.title?.toLowerCase().includes(s) ||
      r?.user?.email?.toLowerCase().includes(s) ||
      r?.userId?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Reservations</h1>
      <p className="text-sm text-slate-500">All client holds across the platform.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search service or client" className="flex-1 border rounded-xl px-3 min-h-[44px] text-sm" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border rounded-xl px-3 min-h-[44px] text-sm">
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border rounded-2xl p-6">No data yet.</p>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {filtered.map((r) => (
              <div key={r.id} className="bg-white border rounded-2xl p-4 space-y-1">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{r?.asset?.title || "Service"}</p>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(r?.status)}`}>{r?.status}</span>
                </div>
                <p className="text-xs text-slate-500 break-all">{r?.user?.email || r?.userId}</p>
                <p className="text-xs text-slate-500">Payment: {r?.paymentType || "—"}</p>
                <p className="text-xs text-slate-500">Expires: {formatDate(r?.expiresAt)}</p>
                <p className="text-sm font-medium">{formatCurrency(r?.installmentTotal || r?.asset?.price)}</p>
              </div>
            ))}
          </div>
          <div className="hidden md:block bg-white border rounded-2xl overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">{r?.user?.email || r?.userId}</td>
                    <td className="px-4 py-3">{r?.asset?.title}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(r?.status)}`}>{r?.status}</span>
                    </td>
                    <td className="px-4 py-3">{r?.paymentType || "—"}</td>
                    <td className="px-4 py-3">{formatDate(r?.expiresAt)}</td>
                    <td className="px-4 py-3">{formatCurrency(r?.installmentTotal || r?.asset?.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
