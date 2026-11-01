"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AdminReservationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/reservations", { credentials: "include" });
      const data = await res.json().catch(() => []);
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Reservations</h1>
      <p className="text-sm text-slate-500">All client holds across the platform (admin totals).</p>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : (
        <div className="bg-white border rounded-2xl overflow-x-auto">
          <table className="min-w-full text-sm">
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
              {items.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">{r.user?.email || r.userId}</td>
                  <td className="px-4 py-3">{r.asset?.title}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3">{r.paymentType || "—"}</td>
                  <td className="px-4 py-3">{r.expiresAt ? formatDate(r.expiresAt) : "—"}</td>
                  <td className="px-4 py-3">{formatCurrency(r.installmentTotal || r.asset?.price || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <p className="p-6 text-sm text-slate-500">No reservations.</p>}
        </div>
      )}
    </div>
  );
}
