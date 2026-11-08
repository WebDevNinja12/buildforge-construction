"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency, formatDate, statusBadgeClass } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export default function AdminInstallmentsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reservations", { credentials: "include" });
      const data = await res.json().catch(() => []);
      const list = (Array.isArray(data) ? data : []).filter(
        (r: any) => r?.paymentType === "INSTALLMENT"
      );
      setItems(list);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelPlan(id: string) {
    const reason =
      window.prompt("Reason for cancelling this installment plan (optional):") ?? null;
    if (reason === null) return;
    if (
      !window.confirm(
        "Cancel this installment plan? Pending payments will fail and the asset may be released."
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/plans/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CANCEL_CONFIRM",
          reason: reason.trim() || "Cancelled by admin",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const res2 = await fetch("/api/admin/reservations", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            action: "CANCEL",
            reason: reason.trim() || "Cancelled by admin",
          }),
        });
        const data2 = await res2.json().catch(() => ({}));
        if (!res2.ok) {
          toast(data.error || data2.error || "Cancel failed", "err");
          return;
        }
      }
      toast("Installment plan cancelled");
      await load();
    } catch {
      toast("Network error", "err");
    } finally {
      setBusyId(null);
    }
  }

  const filtered = items.filter((p) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      p?.asset?.title?.toLowerCase().includes(s) || p?.user?.email?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Installment plans</h1>
      <p className="text-sm text-slate-500">
        Monitor client installment schedules. You can cancel an active plan at any time.
      </p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search"
        className="w-full border rounded-xl px-3 min-h-[44px] text-sm"
      />
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border rounded-2xl p-6">No data yet.</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p) => {
            const total = p?.installmentTotal || p?.asset?.price || 0;
            const paid = p?.installmentPaid || 0;
            const balance = Math.max(0, Number(total) - Number(paid));
            const overdue = p?.nextDueAt && new Date(p.nextDueAt) < new Date();
            const active = ["PENDING", "CONFIRMED"].includes(String(p?.status || ""));
            return (
              <div key={p.id} className="bg-white border rounded-2xl p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold">{p?.asset?.title || "Plan"}</p>
                    <p className="text-xs text-slate-500 break-all">{p?.user?.email}</p>
                    {p?.cancelReason && (
                      <p className="text-xs text-red-600 mt-1">Reason: {p.cancelReason}</p>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-semibold h-fit ${
                      overdue ? "bg-red-100 text-red-700" : statusBadgeClass(p?.status)
                    }`}
                  >
                    {overdue && active ? "Overdue" : p?.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Paid</p>
                    <p className="font-medium">{formatCurrency(paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Balance</p>
                    <p className="font-medium">{formatCurrency(balance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Next due</p>
                    <p className="font-medium">{formatDate(p?.nextDueAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Deadline</p>
                    <p className="font-medium">{formatDate(p?.planDeadlineAt)}</p>
                  </div>
                </div>
                {active && (
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => cancelPlan(p.id)}
                      className="min-h-[44px] px-4 rounded-xl text-xs font-semibold bg-red-600 text-white disabled:opacity-50"
                    >
                      {busyId === p.id ? "Cancelling…" : "Cancel plan"}
                    </button>
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
