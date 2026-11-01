"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  CreditCard,
  Layers,
  AlertTriangle,
  Clock,
  Banknote,
  Loader2,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/Toast";

export function AdminOverview() {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, pay, users] = await Promise.all([
        fetch("/api/admin/overview", { credentials: "include" }),
        fetch("/api/admin/payments?status=PENDING", { credentials: "include" }).catch(() => null),
        fetch("/api/admin/users", { credentials: "include" }),
      ]);
      if (ov?.ok) {
        const d = await ov.json();
        setStats(d.stats || d || {});
      } else setStats({});
      if (pay && pay.ok) {
        const d = await pay.json();
        setPendingPayments(Array.isArray(d) ? d : d?.payments || []);
      } else setPendingPayments([]);
      if (users?.ok) {
        const d = await users.json();
        const list = Array.isArray(d) ? d : d?.users || [];
        setPendingUsers(
          list.filter(
            (u: any) =>
              u?.role === "CLIENT" &&
              (u?.status === "PENDING_APPROVAL" ||
                ["PENDING", "UNDER_REVIEW", "REUPLOAD_REQUIRED"].includes(
                  u?.verificationStatus || ""
                ))
          )
        );
      } else setPendingUsers([]);
    } catch {
      setStats({});
      toast("Could not refresh dashboard", "err");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function reviewPayment(id: string, status: "APPROVED" | "REJECTED") {
    setBusy(id + status);
    try {
      const reason =
        status === "REJECTED" ? prompt("Rejection reason") || "Rejected by admin" : undefined;
      const res = await fetch("/api/admin/payments", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, rejectReason: reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      toast(status === "APPROVED" ? "Payment approved" : "Payment rejected");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "err");
    } finally {
      setBusy("");
    }
  }

  async function setUserStatus(id: string, status: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      toast(status === "APPROVED" ? "Client approved" : `Status: ${status}`);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "err");
    } finally {
      setBusy("");
    }
  }

  if (loading && !stats) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const s = stats || {};
  const cards = [
    { label: "Total Clients", value: s.totalUsers ?? s.totalClients ?? 0, icon: Users, color: "bg-blue-100 text-blue-700" },
    { label: "Pending User Reviews", value: s.pendingReviews ?? 0, icon: UserCheck, color: "bg-amber-100 text-amber-700" },
    { label: "Pending Payments", value: s.pendingPayments ?? 0, icon: CreditCard, color: "bg-orange-100 text-orange-700" },
    { label: "Active Installment Plans", value: s.activeInstallments ?? s.activeReservations ?? 0, icon: Layers, color: "bg-indigo-100 text-indigo-700" },
    { label: "Overdue Payments", value: s.overduePayments ?? 0, icon: AlertTriangle, color: "bg-red-100 text-red-700" },
    { label: "Expiring Reservations", value: s.expiringReservations ?? 0, icon: Clock, color: "bg-yellow-100 text-yellow-800" },
    { label: "Revenue", value: formatCurrency(s.revenue ?? 0), icon: Banknote, color: "bg-green-100 text-green-700" },
  ];

  const nothingPending =
    pendingPayments.length === 0 &&
    pendingUsers.length === 0 &&
    !(s.expiringReservations > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-construction-dark">Admin dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Overview and items that need your attention</p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl border bg-white text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="mt-3 text-xl sm:text-2xl font-bold text-construction-dark break-words">{c.value}</p>
              <p className="text-xs sm:text-sm text-slate-500">{c.label}</p>
            </div>
          );
        })}
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b bg-slate-50">
          <h2 className="font-bold text-construction-dark">Needs your action</h2>
        </div>
        <div className="p-4 sm:p-5 space-y-6">
          {nothingPending ? (
            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              All caught up — nothing pending right now.
            </p>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Pending payments</h3>
            {pendingPayments.length === 0 ? (
              <p className="text-sm text-slate-500">No data yet.</p>
            ) : (
              <ul className="space-y-2">
                {pendingPayments.slice(0, 8).map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-xl px-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{formatCurrency(p?.amount)}</p>
                      <p className="text-xs text-slate-500">
                        {p?.type || "Payment"} · {p?.user?.email || p?.userId || "—"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => reviewPayment(p.id, "APPROVED")}
                        className="inline-flex items-center gap-1 min-h-[44px] text-xs font-semibold bg-green-600 text-white px-3 py-2 rounded-lg"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => reviewPayment(p.id, "REJECTED")}
                        className="inline-flex items-center gap-1 min-h-[44px] text-xs font-semibold bg-red-600 text-white px-3 py-2 rounded-lg"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Pending client reviews</h3>
            {pendingUsers.length === 0 ? (
              <p className="text-sm text-slate-500">No data yet.</p>
            ) : (
              <ul className="space-y-2">
                {pendingUsers.slice(0, 8).map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-xl px-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{u?.name || "—"}</p>
                      <p className="text-xs text-slate-500">
                        {u?.email} · {u?.status} / {u?.verificationStatus}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => setUserStatus(u.id, "APPROVED")}
                        className="min-h-[44px] text-xs font-semibold bg-green-600 text-white px-3 py-2 rounded-lg"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => setUserStatus(u.id, "REJECTED")}
                        className="min-h-[44px] text-xs font-semibold border border-red-200 text-red-600 px-3 py-2 rounded-lg"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/clients" className="text-xs text-primary-600 font-semibold mt-2 inline-block min-h-[44px] leading-[44px]">
              Manage clients →
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Link href="/admin/documents" className="border rounded-xl p-3 hover:bg-slate-50 min-h-[44px]">
              <p className="font-semibold">Pending documents</p>
              <p className="text-xs text-slate-500">Review installment documents</p>
            </Link>
            <Link href="/admin/reservations" className="border rounded-xl p-3 hover:bg-slate-50 min-h-[44px]">
              <p className="font-semibold">Expiring reservations</p>
              <p className="text-xs text-slate-500">{s.expiringReservations ?? 0} holds ending soon</p>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
