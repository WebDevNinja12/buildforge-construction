"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Countdown } from "@/components/Countdown";
import { ServiceImage } from "@/components/ServiceImage";
import { Loader2 } from "lucide-react";
import { InstallmentDocumentsSection } from "@/components/InstallmentDocumentsSection";

async function readJson(res: Response) {
  const text = await res.text();
  if (!text) {
    throw new Error(res.ok ? "Empty response from server" : `Request failed (${res.status})`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok ? "Invalid response from server" : `Request failed (${res.status}): ${text.slice(0, 120)}`
    );
  }
}

export function PlanCard({ plan, onUpdated }: { plan: any; onUpdated?: () => void }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [cancelQuote, setCancelQuote] = useState<any>(null);
  const [frequency, setFrequency] = useState("MONTHLY");
  const [rulesOk, setRulesOk] = useState(false);
  const [docsApproved, setDocsApproved] = useState(plan?.docsStatus === "APPROVED");

  const total =
    plan?.totalAmount || plan?.deposit || plan?.asset?.price || plan?.installmentTotal || 0;
  const paid = plan?.amountPaid || plan?.installmentPaid || 0;
  const balance = Math.max(0, Number(total) - Number(paid));
  const next = (plan?.installments || []).find((i: any) => i?.status === "PENDING");
  const paymentMethod = plan?.paymentMethod || plan?.paymentType;
  const needsMethod = !paymentMethod || paymentMethod === "UNSET" || paymentMethod === "PENDING";
  const isInstallment = paymentMethod === "INSTALLMENT";
  const active = ["INSTALLMENT_PLAN", "PARTIALLY_PAID", "PENDING", "CONFIRMED"].includes(
    plan?.status || ""
  );

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMsg("");
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || data.detail || "Failed");
      if (action === "CANCEL_QUOTE") setCancelQuote(data);
      else {
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

        {plan?.expiresAt && (
          <Countdown expiresAt={plan.expiresAt} status={plan.status} label="Hold expires in" />
        )}

        {needsMethod && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm font-semibold text-construction-dark">Payment method</p>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("SET_PAYMENT_METHOD", { paymentMethod: "FULL" })}
              className="w-full min-h-[44px] text-sm font-semibold border border-slate-200 py-2.5 rounded-xl hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === "SET_PAYMENT_METHOD" ? "Saving…" : "Full payment"}
            </button>
            <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50">
              <p className="text-sm font-semibold">Installment</p>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full border rounded-xl px-3 min-h-[44px] text-sm bg-white"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </select>
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={rulesOk}
                  onChange={(e) => setRulesOk(e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                I have read and agree to the installment rules for this category.
              </label>
              <button
                type="button"
                disabled={!!busy || !rulesOk}
                onClick={() =>
                  act("SET_PAYMENT_METHOD", {
                    paymentMethod: "INSTALLMENT",
                    paymentFrequency: frequency,
                    rulesAgreed: true,
                  })
                }
                className="w-full min-h-[44px] text-sm font-semibold bg-accent-500 hover:bg-accent-600 text-white py-2.5 rounded-xl disabled:opacity-50"
              >
                Continue with installment
              </button>
            </div>
          </div>
        )}

        {isInstallment && (
          <InstallmentDocumentsSection
            reservationId={plan.id}
            category={plan?.asset?.type || "HOUSE"}
            onOverallChange={(_overall, canPay) => setDocsApproved(canPay)}
          />
        )}

        {isInstallment && (docsApproved || plan?.docsStatus === "APPROVED") && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
            Documents approved. You can pay the first deposit below.
          </p>
        )}

        {!needsMethod && active && balance > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 mt-auto">
            <button
              type="button"
              disabled={
                !!busy ||
                (isInstallment &&
                  !docsApproved &&
                  plan?.docsStatus !== "APPROVED" &&
                  plan?.docsStatus !== undefined)
              }
              onClick={() => act("PAY_INSTALLMENT")}
              className="min-h-[44px] text-xs font-semibold bg-primary-600 text-white px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {busy === "PAY_INSTALLMENT" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Pay Now"
              )}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("PAY_REMAINING")}
              className="min-h-[44px] text-xs font-semibold bg-accent-500 text-white px-4 py-2 rounded-xl"
            >
              Pay remaining
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => {
                const amt = prompt("Extra payment amount");
                if (amt) act("EXTRA_PAYMENT", { amount: Number(amt) });
              }}
              className="min-h-[44px] text-xs font-semibold border px-4 py-2 rounded-xl"
            >
              Extra payment
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("CANCEL_QUOTE")}
              className="min-h-[44px] text-xs font-semibold text-red-600 border border-red-200 px-4 py-2 rounded-xl"
            >
              Cancel
            </button>
          </div>
        )}

        {cancelQuote && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm space-y-2">
            <p>{cancelQuote.message}</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="min-h-[44px] text-xs bg-red-600 text-white px-4 py-2 rounded-xl"
                onClick={() => act("CANCEL_CONFIRM", { reason: "Client confirmed" })}
              >
                Confirm cancel
              </button>
              <button
                type="button"
                className="min-h-[44px] text-xs border px-4 py-2 rounded-xl"
                onClick={() => setCancelQuote(null)}
              >
                Keep
              </button>
            </div>
          </div>
        )}

        {msg && (
          <p className="text-xs text-slate-700 bg-slate-50 border rounded-xl px-3 py-2">{msg}</p>
        )}
      </div>
    </div>
  );
}
