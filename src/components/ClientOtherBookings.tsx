"use client";

import { useEffect, useState } from "react";
import {
  formatCurrency,
  formatDate,
  statusBadgeClass,
  PAYMENT_METHOD_LABEL,
} from "@/lib/utils";
import { Countdown } from "@/components/Countdown";
import { BankTransferPayPanel } from "@/components/BankTransferPayPanel";
import { HardHat, Loader2, Landmark, Wrench } from "lucide-react";

type Rental = {
  id: string;
  status: string;
  total?: number | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  expiresAt?: string | Date | null;
  tool?: { name?: string; category?: string; dailyRate?: number };
  payments?: Array<{ id: string; status: string; amount: number }>;
};

type Hire = {
  id: string;
  status: string;
  total?: number | null;
  notes?: string | null;
  location?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  expiresAt?: string | Date | null;
  worker?: { name?: string; specialty?: string; dailyRate?: number };
  payments?: Array<{ id: string; status: string; amount: number }>;
};

const TERMINAL = ["CANCELLED", "EXPIRED", "COMPLETED", "REFUNDED", "REJECTED"];

export function ClientOtherBookings() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [hires, setHires] = useState<Hire[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [payOpenId, setPayOpenId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/client/bookings", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setRentals(Array.isArray(data.toolRentals) ? data.toolRentals : []);
      setHires(Array.isArray(data.hireRequests) ? data.hireRequests : []);
    } catch {
      setRentals([]);
      setHires([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function pay(kind: "tool" | "hire", id: string, amount: number) {
    if (!(amount > 0)) {
      setMsg("No amount due on this booking.");
      return;
    }
    setBusyId(id);
    setMsg("");
    try {
      const body =
        kind === "tool"
          ? { toolRentalId: id, amount, type: "TOOL_RENTAL", currency: "NGN" }
          : { hireRequestId: id, amount, type: "WORKER_HIRE", currency: "NGN" };
      const res = await fetch("/api/payments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Payment failed");
      setMsg(data.message || "Bank transfer submitted for admin approval");
      setPayOpenId(null);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusyId("");
    }
  }

  async function extendBooking(kind: "TOOL" | "WORKER", id: string) {
    const raw = window.prompt("How many extra days? (1–30)", "3");
    if (raw == null) return;
    const days = Math.floor(Number(raw));
    if (!(days >= 1 && days <= 30)) {
      setMsg("Enter between 1 and 30 days");
      return;
    }
    setBusyId(`ext-${id}`);
    setMsg("");
    try {
      const quoteRes = await fetch("/api/client/extend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, extraDays: days, action: "QUOTE" }),
      });
      const quote = await quoteRes.json().catch(() => ({}));
      if (
        !window.confirm(
          `${quote.message || quote.note || "Confirm extension"}\nFee: ${quote.fee ?? "—"}\n\nPay by ${PAYMENT_METHOD_LABEL} then submit?`
        )
      ) {
        setBusyId("");
        return;
      }
      const res = await fetch("/api/client/extend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, extraDays: days, action: "CONFIRM" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Extension failed");
      setMsg(data.message || "Extension requested (bank transfer pending approval)");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Extension failed");
    } finally {
      setBusyId("");
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading tools & worker bookings…
      </p>
    );
  }

  const activeRentals = rentals.filter((r) => !TERMINAL.includes(String(r.status).toUpperCase()));
  const activeHires = hires.filter((h) => !TERMINAL.includes(String(h.status).toUpperCase()));

  if (!activeRentals.length && !activeHires.length) {
    return (
      <p className="text-sm text-slate-500 text-center py-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        No tool or worker bookings yet. Reserve from Services, then pay by {PAYMENT_METHOD_LABEL}{" "}
        here.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {msg && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
          {msg}
        </p>
      )}

      {activeRentals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary-700" />
            <h3 className="text-base font-bold text-construction-dark">Tool rentals</h3>
          </div>
          <p className="text-xs text-slate-500">
            Settlement is <strong>{PAYMENT_METHOD_LABEL}</strong> only. Transfer the amount, then
            confirm on the booking card.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeRentals.map((r) => {
              const amount = Number(r.total || r.tool?.dailyRate || 0);
              const pendingPay = (r.payments || []).some((p) => p.status === "PENDING");
              const paid = (r.payments || []).some((p) => p.status === "APPROVED");
              const open = payOpenId === r.id;
              return (
                <div
                  key={r.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2"
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold text-sm text-construction-dark">
                      {r.tool?.name || "Tool"}
                    </p>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full h-fit ${statusBadgeClass(
                        r.status
                      )}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {r.tool?.category || "Equipment"}
                    {r.startDate ? ` · ${formatDate(r.startDate)}` : ""}
                    {r.endDate ? ` → ${formatDate(r.endDate)}` : ""}
                  </p>
                  <p className="text-sm font-semibold">{formatCurrency(amount)}</p>
                  {r.expiresAt && (
                    <Countdown
                      expiresAt={r.expiresAt}
                      status={r.status}
                      label="Hold expires in"
                      variant="badge"
                      showWhenSettled={false}
                    />
                  )}
                  {!paid && !pendingPay && amount > 0 && !open && (
                    <button
                      type="button"
                      onClick={() => setPayOpenId(r.id)}
                      className="w-full min-h-[44px] rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                    >
                      <Landmark className="w-4 h-4" />
                      Pay with bank transfer · {formatCurrency(amount)}
                    </button>
                  )}
                  {!paid && !pendingPay && amount > 0 && open && (
                    <BankTransferPayPanel
                      amount={amount}
                      reference={r.id}
                      busy={busyId === r.id}
                      onCancel={() => setPayOpenId(null)}
                      onConfirm={() => pay("tool", r.id, amount)}
                    />
                  )}
                  {pendingPay && (
                    <p className="text-xs text-amber-700 font-medium">
                      Bank transfer pending admin approval
                    </p>
                  )}
                  {paid && (
                    <>
                      <p className="text-xs text-green-700 font-medium">Payment approved</p>
                      <button
                        type="button"
                        disabled={busyId === `ext-${r.id}`}
                        onClick={() => extendBooking("TOOL", r.id)}
                        className="w-full min-h-[40px] rounded-xl border border-primary-600 text-primary-700 text-xs font-semibold disabled:opacity-50"
                      >
                        {busyId === `ext-${r.id}` ? "…" : "Extend rental period"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeHires.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HardHat className="w-4 h-4 text-primary-700" />
            <h3 className="text-base font-bold text-construction-dark">Worker hires</h3>
          </div>
          <p className="text-xs text-slate-500">
            Workers use full payment only (no installment). Pay by{" "}
            <strong>{PAYMENT_METHOD_LABEL}</strong>.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeHires.map((h) => {
              const amount = Number(h.total || h.worker?.dailyRate || 0);
              const pendingPay = (h.payments || []).some((p) => p.status === "PENDING");
              const paid = (h.payments || []).some((p) => p.status === "APPROVED");
              const open = payOpenId === h.id;
              return (
                <div
                  key={h.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2"
                >
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold text-sm text-construction-dark">
                      {h.worker?.name || "Worker"}
                    </p>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full h-fit ${statusBadgeClass(
                        h.status
                      )}`}
                    >
                      {h.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {h.worker?.specialty || "Labour"}
                    {h.location ? ` · ${h.location}` : ""}
                    {h.startDate ? ` · ${formatDate(h.startDate)}` : ""}
                  </p>
                  <p className="text-sm font-semibold">{formatCurrency(amount)}</p>
                  {h.expiresAt && (
                    <Countdown
                      expiresAt={h.expiresAt}
                      status={h.status}
                      label="Hold expires in"
                      variant="badge"
                      showWhenSettled={false}
                    />
                  )}
                  {!paid && !pendingPay && amount > 0 && !open && (
                    <button
                      type="button"
                      onClick={() => setPayOpenId(h.id)}
                      className="w-full min-h-[44px] rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                    >
                      <Landmark className="w-4 h-4" />
                      Pay with bank transfer · {formatCurrency(amount)}
                    </button>
                  )}
                  {!paid && !pendingPay && amount > 0 && open && (
                    <BankTransferPayPanel
                      amount={amount}
                      reference={h.id}
                      busy={busyId === h.id}
                      onCancel={() => setPayOpenId(null)}
                      onConfirm={() => pay("hire", h.id, amount)}
                    />
                  )}
                  {pendingPay && (
                    <p className="text-xs text-amber-700 font-medium">
                      Bank transfer pending admin approval
                    </p>
                  )}
                  {paid && (
                    <>
                      <p className="text-xs text-green-700 font-medium">Payment approved</p>
                      <button
                        type="button"
                        disabled={busyId === `ext-${h.id}`}
                        onClick={() => extendBooking("WORKER", h.id)}
                        className="w-full min-h-[40px] rounded-xl border border-primary-600 text-primary-700 text-xs font-semibold disabled:opacity-50"
                      >
                        {busyId === `ext-${h.id}` ? "…" : "Extend hire period"}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
