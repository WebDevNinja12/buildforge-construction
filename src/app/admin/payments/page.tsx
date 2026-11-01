"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function AdminPaymentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payments?status=${status}`, { credentials: "include" });
      if (!res.ok) {
        // fallback all payments via overview path
        const res2 = await fetch("/api/admin/payments", { credentials: "include" });
        const d = await res2.json().catch(() => []);
        const list = Array.isArray(d) ? d : d.payments || [];
        setItems(status === "ALL" ? list : list.filter((p: any) => p.status === status));
      } else {
        const d = await res.json();
        setItems(Array.isArray(d) ? d : d.payments || []);
      }
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
    if (!res.ok) setMsg(data.error || "Failed");
    else {
      setMsg(`Payment ${next.toLowerCase()}`);
      load();
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Payments</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded-xl px-3 py-2 text-sm">
        <option value="PENDING">Pending</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
        <option value="ALL">All</option>
      </select>
      {msg && <p className="text-sm">{msg}</p>}
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : (
        <div className="bg-white border rounded-2xl overflow-x-auto">
          <table className="min-w-full text-sm">
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
              {items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3">{formatDate(p.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3">{p.type}</td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3">
                    {p.status === "PENDING" && (
                      <div className="flex gap-1">
                        <button type="button" className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg" onClick={() => review(p.id, "APPROVED")}>
                          Approve
                        </button>
                        <button type="button" className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg" onClick={() => review(p.id, "REJECTED")}>
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <p className="p-6 text-sm text-slate-500">No payments in this filter.</p>}
        </div>
      )}
    </div>
  );
}
