"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatCurrency, formatDate, statusBadgeClass } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export default function AdminReservationsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function act(id: string, action: "ACCEPT" | "REJECT") {
    if (action === "REJECT") {
      const reason =
        window.prompt("Reason for cancelling this plan (optional):") ?? null;
      if (reason === null) return;
      if (!window.confirm("Cancel this reservation/plan and free the service if possible?")) {
        return;
      }
      setBusyId(id);
      try {
        const res = await fetch("/api/admin/reservations", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            action: "REJECT",
            status: "REJECTED",
            reason: reason.trim() || "Cancelled by admin",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast(data.error || data.detail || "Cancel failed", "err");
          return;
        }
        toast("Plan cancelled");
        await load();
      } catch {
        toast("Network error", "err");
      } finally {
        setBusyId(null);
      }
      return;
    }

    setBusyId(id);
    try {
      const res = await fetch("/api/admin/reservations", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action,
          status: "APPROVED",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || data.detail || "Action failed", "err");
        return;
      }
      toast("Reservation accepted");
      await load();
    } catch {
      toast("Network error", "err");
    } finally {
      setBusyId(null);
    }
  }

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
      <p className="text-sm text-slate-500">
        Accept pending holds, or cancel any active plan (pending or confirmed). Cancel frees the
        service when no other hold exists.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search service or client"
          className="flex-1 border rounded-xl px-3 min-h-[44px] text-sm"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-xl px-3 min-h-[44px] text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border rounded-2xl p-6">No data yet.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const active = ["PENDING", "CONFIRMED"].includes(String(r.status || ""));
            return (
              <div
                key={r.id}
                className="bg-white border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{r?.asset?.title || "Service"}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {r?.user?.email || r?.userId}
                    {r?.asset?.price != null ? ` · ${formatCurrency(Number(r.asset.price))}` : ""}
                    {r?.paymentType ? ` · ${r.paymentType}` : ""}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(r.createdAt)}
                    {r.expiresAt ? ` · expires ${formatDate(r.expiresAt)}` : ""}
                  </p>
                  {r.cancelReason && (
                    <p className="text-xs text-red-600 mt-1">Cancel reason: {r.cancelReason}</p>
                  )}
                  <span
                    className={`inline-block mt-1 text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(
                      r.status
                    )}`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {r.status === "PENDING" && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      className="min-h-[44px] text-xs font-semibold bg-green-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                      onClick={() => act(r.id, "ACCEPT")}
                    >
                      {busyId === r.id ? "…" : "Accept"}
                    </button>
                  )}
                  {active && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      className="min-h-[44px] text-xs font-semibold bg-red-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                      onClick={() => act(r.id, "REJECT")}
                    >
                      {busyId === r.id ? "…" : "Cancel plan"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
