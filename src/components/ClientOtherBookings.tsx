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

type Payment = { id: string; status: string; amount: number };

type Rental = {
  id: string;
  status: string;
  total?: number | null;
  installmentPaid?: number | null;
  paymentType?: string | null;
  scheduleJson?: string | null;
  installmentFrequency?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  expiresAt?: string | Date | null;
  tool?: {
    id?: string;
    name?: string;
    category?: string;
    dailyRate?: number;
    weeklyRate?: number;
    image?: string | null;
  };
  payments?: Payment[];
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
  payments?: Payment[];
};

const TERMINAL = ["CANCELLED", "EXPIRED", "COMPLETED", "REFUNDED", "REJECTED"];

function approvedPaid(payments?: Payment[], fallback = 0) {
  const sum = (payments || [])
    .filter((p) => String(p.status).toUpperCase() === "APPROVED")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  return Math.max(sum, fallback);
}

function parseSchedule(json?: string | null) {
  if (!json) return [] as Array<{ amount: number; status?: string; dueDate?: string }>;
  try {
    const d = JSON.parse(json);
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

export function ClientOtherBookings() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [hires, setHires] = useState<Hire[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [payOpenId, setPayOpenId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [frequency, setFrequency] = useState("MONTHLY");

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

  async function toolAct(id: string, action: string, extra: Record<string, unknown> = {}) {
    setBusyId(id);
    setMsg("");
    try {
      const res = await fetch(`/api/tools/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || "Request failed");
      setMsg(data.message || "Updated");
      if (String(action).startsWith("PAY")) setPayOpenId(null);
      await load();
      return data;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
      return null;
    } finally {
      setBusyId("");
    }
  }

  async function payHire(id: string, amount: number) {
    if (!(amount > 0)) {
      setMsg("No amount due on this booking.");
      return;
    }
    setBusyId(id);
    setMsg("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hireRequestId: id,
          amount,
          type: "WORKER_HIRE",
          currency: "NGN",
        }),
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
            Full feature hire: choose full or installment, pay by{" "}
            <strong>{PAYMENT_METHOD_LABEL}</strong>, cancel (10% fee), or extend after full payment.
            Hold is typically 60 hours; installment extends hold by 24 hours.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {activeRentals.map((r) => {
              const total = Number(r.total || r.tool?.dailyRate || 0);
              const paid = approvedPaid(r.payments, Number(r.installmentPaid || 0));
              const balance = Math.max(0, total - paid);
              const pendingPay = (r.payments || []).some(
                (p) => String(p.status).toUpperCase() === "PENDING"
              );
              const fullyPaid = balance <= 0.01 && paid > 0;
              const paymentType = String(r.paymentType || "UNSET").toUpperCase();
              const needsMethod = !paymentType || paymentType === "UNSET";
              const isInstallment = paymentType === "INSTALLMENT";
              const schedule = parseSchedule(r.scheduleJson);
              const next = schedule.find((i) => (i.status || "PENDING") === "PENDING");
              const open = payOpenId === r.id;
              const canCancel = !fullyPaid && !["CANCELLED", "EXPIRED"].includes(r.status);

              return (
                <div
                  key={r.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-construction-dark truncate">
                        {r.tool?.name || "Tool"}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {r.tool?.category || "Equipment"}
                        {r.startDate ? ` · ${formatDate(r.startDate)}` : ""}
                        {r.endDate ? ` → ${formatDate(r.endDate)}` : ""}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full h-fit shrink-0 ${statusBadgeClass(
                        r.status
                      )}`}
                    >
                      {r.status}
                    </span>
                  </div>

                  <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                    {needsMethod
                      ? "Choose plan type"
                      : isInstallment
                        ? `Installment · ${PAYMENT_METHOD_LABEL}`
                        : `Full · ${PAYMENT_METHOD_LABEL}`}
                  </span>

                  {r.expiresAt && !fullyPaid && (
                    <Countdown
                      expiresAt={r.expiresAt}
                      status={r.status}
                      label="Hold expires in"
                      variant="badge"
                      showWhenSettled={false}
                    />
                  )}

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="bg-slate-50 rounded-xl p-2">
                      <p className="text-[10px] text-slate-400">Total</p>
                      <p className="font-semibold text-xs">{formatCurrency(total)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2">
                      <p className="text-[10px] text-slate-400">Paid</p>
                      <p className="font-semibold text-xs text-green-700">{formatCurrency(paid)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2">
                      <p className="text-[10px] text-slate-400">Balance</p>
                      <p className="font-semibold text-xs text-amber-700">
                        {formatCurrency(balance)}
                      </p>
                    </div>
                  </div>

                  {needsMethod && (
                    <div className="space-y-2 border-t pt-3">
                      <p className="text-xs font-semibold text-construction-dark">Choose plan type</p>
                      <p className="text-[11px] text-slate-500">
                        Settlement is always <strong>{PAYMENT_METHOD_LABEL}</strong> (Opay).
                      </p>
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => toolAct(r.id, "SET_PAYMENT_METHOD", { paymentMethod: "FULL" })}
                        className="w-full min-h-[44px] rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
                      >
                        Full payment (bank transfer)
                      </button>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        className="w-full border rounded-xl px-3 min-h-[40px] text-sm"
                      >
                        {["MONTHLY", "WEEKLY", "QUARTERLY", "YEARLY"].map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() =>
                          toolAct(r.id, "SET_PAYMENT_METHOD", {
                            paymentMethod: "INSTALLMENT",
                            paymentFrequency: frequency,
                          })
                        }
                        className="w-full min-h-[44px] rounded-xl border border-primary-600 text-primary-700 text-sm font-semibold disabled:opacity-50"
                      >
                        Installment plan (bank transfer)
                      </button>
                      <p className="text-[10px] text-slate-500">
                        Installment: 40% first, then 20% each. Tools: 1% admin fee (not interest).
                        Choosing installment extends hold by 24h.
                      </p>
                    </div>
                  )}

                  {!needsMethod && balance > 0 && !pendingPay && (
                    <div className="space-y-2 border-t pt-3">
                      {!open ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const amt = isInstallment
                                ? Number(next?.amount || total * 0.4)
                                : balance || total;
                              setPayAmount(amt);
                              setPayOpenId(r.id);
                            }}
                            className="w-full min-h-[48px] rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                          >
                            <Landmark className="w-4 h-4" />
                            Pay with bank transfer
                            {isInstallment && next
                              ? ` · ${formatCurrency(Number(next.amount))}`
                              : ` · ${formatCurrency(balance)}`}
                          </button>
                          {isInstallment && balance > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPayAmount(balance);
                                setPayOpenId(r.id);
                              }}
                              className="w-full min-h-[40px] rounded-xl border text-sm font-semibold text-slate-700"
                            >
                              Pay remaining · {formatCurrency(balance)}
                            </button>
                          )}
                        </>
                      ) : (
                        <BankTransferPayPanel
                          amount={payAmount || balance}
                          reference={r.id}
                          busy={busyId === r.id}
                          onCancel={() => setPayOpenId(null)}
                          onConfirm={() =>
                            toolAct(r.id, isInstallment ? "PAY_INSTALLMENT" : "PAY_NOW", {
                              amount: payAmount || balance,
                            })
                          }
                        />
                      )}
                    </div>
                  )}

                  {pendingPay && (
                    <p className="text-xs text-amber-700 font-medium">
                      Bank transfer pending admin approval
                    </p>
                  )}

                  {fullyPaid && (
                    <>
                      <p className="text-xs text-green-700 font-medium">Fully paid — hire confirmed</p>
                      <button
                        type="button"
                        disabled={busyId === `ext-${r.id}`}
                        onClick={() => extendBooking("TOOL", r.id)}
                        className="w-full min-h-[40px] rounded-xl border border-primary-600 text-primary-700 text-xs font-semibold disabled:opacity-50"
                      >
                        {busyId === `ext-${r.id}` ? "…" : "Extend rental period"}
                      </button>
                      <p className="text-[10px] text-slate-400">
                        Extension fees are separate from installment rules.
                      </p>
                    </>
                  )}

                  {canCancel && (
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={async () => {
                        const quote = await toolAct(r.id, "CANCEL_QUOTE");
                        if (!quote) return;
                        const note =
                          quote.message ||
                          "Cancellation may apply a 10% deduction on amounts already paid.";
                        if (!window.confirm(`${note}\n\nConfirm cancel?`)) return;
                        await toolAct(r.id, "CANCEL_CONFIRM", { reason: "Client cancelled" });
                      }}
                      className="w-full min-h-[36px] rounded-xl text-xs font-semibold text-red-700 border border-red-100 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel tool rental
                    </button>
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
              const pendingPay = (h.payments || []).some(
                (p) => String(p.status).toUpperCase() === "PENDING"
              );
              const paid = (h.payments || []).some(
                (p) => String(p.status).toUpperCase() === "APPROVED"
              );
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
                      onClick={() => {
                        setPayAmount(amount);
                        setPayOpenId(h.id);
                      }}
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
                      onConfirm={() => payHire(h.id, amount)}
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
