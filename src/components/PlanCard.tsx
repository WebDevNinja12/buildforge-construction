"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Countdown } from "@/components/Countdown";
import { ServiceImage } from "@/components/ServiceImage";
import { Loader2 } from "lucide-react";

export function PlanCard({ plan, onUpdated }: { plan: any; onUpdated?: () => void }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [cancelQuote, setCancelQuote] = useState<any>(null);

  const total = plan.totalAmount || plan.deposit;
  const paid = plan.amountPaid || 0;
  const balance = Math.max(0, total - paid);
  const next = (plan.installments || []).find((i: any) => i.status === "PENDING");
  const active = ["INSTALLMENT_PLAN", "PARTIALLY_PAID", "PENDING", "CONFIRMED"].includes(plan.status);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMsg("");
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (action === "CANCEL_QUOTE") {
        setCancelQuote(data);
      } else {
        setMsg(data.message || "Done");
        setCancelQuote(null);
        onUpdated?.();
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
      <ServiceImage imagesJson={plan.asset?.images} mainIndex={plan.asset?.mainImageIndex} alt={plan.asset?.title} />
      <div className="p-4 space-y-2">
        <div className="flex justify-between gap-2">
          <h3 className="font-semibold text-construction-dark">{plan.asset?.title}</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">{plan.status}</span>
        </div>
        <p className="text-sm text-slate-500">
          {plan.paymentMethod}
          {plan.paymentFrequency ? ` · ${plan.paymentFrequency}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-slate-400 text-xs">Total</p>
            <p className="font-medium">{formatCurrency(total)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Paid</p>
            <p className="font-medium text-green-700">{formatCurrency(paid)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Balance</p>
            <p className="font-medium text-amber-700">{formatCurrency(balance)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs">Next due</p>
            <p className="font-medium">
              {next ? formatCurrency(next.amount) : "—"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {next?.dueDate && (
            <Countdown expiresAt={next.dueDate} status={plan.status} label="Next payment in" />
          )}
          {plan.planDeadline && (
            <Countdown expiresAt={plan.planDeadline} status={plan.status} label="Plan ends in" />
          )}
          {plan.expiresAt && plan.status === "PENDING" && (
            <Countdown expiresAt={plan.expiresAt} status={plan.status} label="Hold expires in" />
          )}
        </div>

        {active && balance > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("PAY_INSTALLMENT")}
              className="text-xs font-semibold bg-primary-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              {busy === "PAY_INSTALLMENT" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Pay Now"}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("PAY_REMAINING")}
              className="text-xs font-semibold bg-accent-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
            >
              Pay Remaining Balance
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => {
                const amt = prompt("Extra payment amount");
                if (amt) act("EXTRA_PAYMENT", { amount: Number(amt) });
              }}
              className="text-xs font-semibold border px-3 py-1.5 rounded-lg"
            >
              Extra payment
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("CANCEL_QUOTE")}
              className="text-xs font-semibold text-red-600 border border-red-200 px-3 py-1.5 rounded-lg"
            >
              Cancel plan
            </button>
          </div>
        )}

        {cancelQuote && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm space-y-2">
            <p>{cancelQuote.message}</p>
            <p className="text-xs text-slate-600">
              Deduction {cancelQuote.cancellationPercent}% · Refund {formatCurrency(cancelQuote.refundAmount)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg"
                onClick={() => act("CANCEL_CONFIRM", { reason: "Client confirmed cancellation" })}
              >
                Confirm cancel
              </button>
              <button type="button" className="text-xs border px-3 py-1.5 rounded-lg" onClick={() => setCancelQuote(null)}>
                Keep plan
              </button>
            </div>
          </div>
        )}

        {msg && <p className="text-xs text-slate-600">{msg}</p>}
      </div>
    </div>
  );
}
