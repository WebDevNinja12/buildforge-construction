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

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments?status=${status}`, { credentials: "include" });
      let list: any[] = [];
      if (res.ok) {
        const d = await res.json();
        list = Array.isArray(d) ? d : d?.payments || [];
      } else {
        const res2 = await fetch("/api/admin/payments", { credentials: "include" });
        const d = await res2.json().catch(() => []);
        list = Array.isArray(d) ? d : d?.payments || [];
        if (status !== "ALL") list = list.filter((p) => p?.status === status);
      }
      setItems(list);
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

  async function review(id: string, next: "APPROVED" | "REJECTED") {
    const reason = next === "REJECTED" ? prompt("Reason") || "Rejected" : undefined;
    const res = await fetch("/api/admin/payments", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: next, rejectReason: reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) toast(data.error || "Failed", "err");
    else {
      toast(next === "APPROVED" ? "Payment approved" : "Payment rejected");
      load();
    }
  }

  const filtered = items.filter((p) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      String(p?.type || "").toLowerCase().includes(s) ||
      String(p?.userId || "").toLowerCase().includes(s) ||
      String(p?.user?.email || "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Payments</h1>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search type or user"
          className="flex-1 border rounded-xl px-3 min-h-[44px] text-sm"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-xl px-3 min-h-[44px] text-sm">
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="ALL">All</option>
        </select>
      </div>

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border rounded-2xl p-6">No data yet.</p>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {filtered.map((p) => (
              <div key={p.id} className="bg-white border rounded-2xl p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{formatCurrency(p?.amount)}</p>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(p?.status)}`}>
                    {p?.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{p?.type} · {formatDate(p?.createdAt)}</p>
                <p className="text-xs text-slate-500 break-all">{p?.user?.email || p?.userId}</p>
                {p?.status === "PENDING" && (
                  <div className="flex gap-2 pt-1">
                    <button type="button" className="min-h-[44px] flex-1 text-xs font-semibold bg-green-600 text-white rounded-lg" onClick={() => review(p.id, "APPROVED")}>
                      Approve
                    </button>
                    <button type="button" className="min-h-[44px] flex-1 text-xs font-semibold bg-red-600 text-white rounded-lg" onClick={() => review(p.id, "REJECTED")}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="hidden md:block bg-white border rounded-2xl overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-slate-50 text-xs text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-3">{formatDate(p?.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(p?.amount)}</td>
                    <td className="px-4 py-3">{p?.type}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(p?.status)}`}>
                        {p?.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p?.status === "PENDING" && (
                        <div className="flex gap-2">
                          <button type="button" className="min-h-[44px] text-xs font-semibold bg-green-600 text-white px-3 py-2 rounded-lg" onClick={() => review(p.id, "APPROVED")}>
                            Approve
                          </button>
                          <button type="button" className="min-h-[44px] text-xs font-semibold bg-red-600 text-white px-3 py-2 rounded-lg" onClick={() => review(p.id, "REJECTED")}>
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
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
