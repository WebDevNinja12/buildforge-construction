"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Countdown } from "@/components/Countdown";
import { ServiceImage } from "@/components/ServiceImage";
import { Loader2 } from "lucide-react";
import { InstallmentDocumentsSection } from "@/components/InstallmentDocumentsSection";

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || "Invalid response" };
  }
}

export function PlanCard({ plan: initial, onUpdated }: { plan: any; onUpdated?: () => void }) {
  const [plan, setPlan] = useState(initial);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");

  const total = Number(plan?.totalAmount ?? plan?.installmentTotal ?? plan?.asset?.price ?? 0);
  const paid = Number(plan?.amountPaid ?? plan?.installmentPaid ?? 0);
  const balance = Math.max(0, total - paid);
  const paymentMethod = plan?.paymentMethod || plan?.paymentType || "UNSET";
  const needsMethod = !paymentMethod || paymentMethod === "UNSET";
  const installments = Array.isArray(plan?.installments)
    ? plan.installments
    : (() => {
        try {
          return JSON.parse(plan?.scheduleJson || "[]");
        } catch {
          return [];
        }
      })();
  const next = installments.find((i: any) => (i.status || "PENDING") === "PENDING");

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMsg("");
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || data.detail || "Request failed");
      if (data.plan) setPlan(data.plan);
      setMsg(data.message || "Updated");
      onUpdated?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <ServiceImage
        imagesJson={plan?.asset?.images}
        mainIndex={plan?.asset?.mainImageIndex}
        alt={plan?.asset?.title}
      />
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex justify-between gap-2">
          <h3 className="font-semibold text-construction-dark leading-snug">
            {plan?.asset?.title || "Reservation"}
          </h3>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 h-fit shrink-0">
            {plan?.status}
          </span>
        </div>
        <p className="text-sm text-slate-500">
          {needsMethod ? "Choose payment method below" : paymentMethod}
          {plan?.paymentFrequency || plan?.installmentFrequency
            ? ` · ${plan?.paymentFrequency || plan?.installmentFrequency}`
            : ""}
        </p>

        {/* Live ticking clock */}
        {plan?.expiresAt ? (
          <Countdown
            expiresAt={plan.expiresAt}
            status={plan.status}
            label="Hold expires in"
            variant="clock"
            showWhenSettled={false}
          />
        ) : (
          <p className="text-xs text-slate-400">No hold expiry set on this reservation.</p>
        )}

        {plan?.nextDueAt && paymentMethod === "INSTALLMENT" && (
          <Countdown
            expiresAt={plan.nextDueAt}
            status={plan.status}
            label="Next installment due in"
            variant="badge"
            showWhenSettled
          />
        )}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-slate-400 text-[11px]">Total</p>
            <p className="font-semibold">{formatCurrency(total)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-slate-400 text-[11px]">Paid</p>
            <p className="font-semibold text-green-700">{formatCurrency(paid)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-slate-400 text-[11px]">Balance</p>
            <p className="font-semibold text-amber-700">{formatCurrency(balance)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5">
            <p className="text-slate-400 text-[11px]">Next due</p>
            <p className="font-semibold">{next ? formatCurrency(next.amount) : "—"}</p>
          </div>
        </div>

        {needsMethod && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm font-semibold text-construction-dark">Payment method</p>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("SET_PAYMENT_METHOD", { paymentMethod: "FULL" })}
              className="w-full min-h-[44px] rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {busy === "SET_PAYMENT_METHOD" ? "Saving…" : "Full payment"}
            </button>
            <div className="space-y-2">
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full border rounded-xl px-3 min-h-[44px] text-sm"
              >
                {["MONTHLY", "WEEKLY", "QUARTERLY", "YEARLY"].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!!busy}
                onClick={() =>
                  act("SET_PAYMENT_METHOD", {
                    paymentMethod: "INSTALLMENT",
                    paymentFrequency: frequency,
                  })
                }
                className="w-full min-h-[44px] rounded-xl border border-primary-600 text-primary-700 text-sm font-semibold disabled:opacity-50"
              >
                Installment payment
              </button>
            </div>
          </div>
        )}

        {paymentMethod === "INSTALLMENT" && (
          <InstallmentDocumentsSection reservationId={plan.id} />
        )}

        {!needsMethod && balance > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("PAY_NOW")}
              className="w-full min-h-[44px] rounded-xl bg-accent-500 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy === "PAY_NOW" && <Loader2 className="w-4 h-4 animate-spin" />}
              Pay now
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("PAY_REMAINING")}
              className="w-full min-h-[44px] rounded-xl border text-sm font-semibold disabled:opacity-50"
            >
              Pay remaining balance
            </button>
          </div>
        )}

        {msg && <p className="text-xs text-slate-600">{msg}</p>}
      </div>
    </div>
  );
}
