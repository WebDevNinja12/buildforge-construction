"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AdminInstallmentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/reservations", { credentials: "include" });
      const data = await res.json().catch(() => []);
      const list = (Array.isArray(data) ? data : []).filter(
        (r: any) => r.paymentType === "INSTALLMENT"
      );
      setItems(list);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Installment plans</h1>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : (
        <div className="grid gap-3">
          {items.map((p) => {
            const total = p.installmentTotal || p.asset?.price || 0;
            const paid = p.installmentPaid || 0;
            const balance = Math.max(0, total - paid);
            const overdue = p.nextDueAt && new Date(p.nextDueAt) < new Date();
            return (
              <div key={p.id} className="bg-white border rounded-2xl p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold">{p.asset?.title}</p>
                    <p className="text-xs text-slate-500">{p.user?.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${overdue ? "bg-red-100 text-red-700" : "bg-slate-100"}`}>
                    {overdue ? "Overdue" : p.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-sm">
                  <div><p className="text-xs text-slate-400">Paid</p><p className="font-medium">{formatCurrency(paid)}</p></div>
                  <div><p className="text-xs text-slate-400">Balance</p><p className="font-medium">{formatCurrency(balance)}</p></div>
                  <div><p className="text-xs text-slate-400">Next due</p><p className="font-medium">{p.nextDueAt ? formatDate(p.nextDueAt) : "—"}</p></div>
                  <div><p className="text-xs text-slate-400">Deadline</p><p className="font-medium">{p.planDeadlineAt ? formatDate(p.planDeadlineAt) : "—"}</p></div>
                </div>
              </div>
            );
          })}
          {!items.length && <p className="text-sm text-slate-500">No installment plans yet.</p>}
        </div>
      )}
    </div>
  );
}
