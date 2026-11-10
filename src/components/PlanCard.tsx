"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Countdown } from "@/components/Countdown";
import { ServiceImage } from "@/components/ServiceImage";
import { FileText, Loader2, Lock, CheckCircle2 } from "lucide-react";

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
  const [docsOverall, setDocsOverall] = useState<string>(
    String(initial?.docsStatus || "INCOMPLETE").toUpperCase()
  );
  const docsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlan(initial);
    if (initial?.docsStatus) setDocsOverall(String(initial.docsStatus).toUpperCase());
  }, [initial]);

  const total = Number(plan?.totalAmount ?? plan?.installmentTotal ?? plan?.asset?.price ?? 0);
  const paid = Number(plan?.amountPaid ?? plan?.installmentPaid ?? 0);
  const balance = Math.max(0, total - paid);
  const paymentMethod = plan?.paymentMethod || plan?.paymentType || "UNSET";
  const needsMethod = !paymentMethod || paymentMethod === "UNSET";
  const isInstallment = paymentMethod === "INSTALLMENT";
  const docsApproved = docsOverall === "APPROVED";
  const firstInstallmentGate = isInstallment && paid <= 0 && !docsApproved;
  const statusUpper = String(plan?.status || "").toUpperCase();
  const fullyPaid =
    (total > 0 && paid >= total) || ["FULLY_PAID", "COMPLETED"].includes(statusUpper);
  /** Full payment completed → cannot cancel */
  const canCancel =
    !fullyPaid &&
    !["CANCELLED", "EXPIRED", "FULLY_PAID", "COMPLETED", "REFUNDED"].includes(statusUpper);

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

  function goDocuments() {
    if (typeof window !== "undefined") {
      window.location.hash = "documents";
    }
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setMsg("");
    try {
      if (
        (action === "PAY_NOW" ||
          action === "PAY_INSTALLMENT" ||
          action === "PAY_REMAINING" ||
          action === "PAY_FULL") &&
        isInstallment &&
        paid <= 0 &&
        !docsApproved
      ) {
        setMsg(
          "Upload required documents in the Documents section first. Payment unlocks after admin approval."
        );
        goDocuments();
        return;
      }

      const res = await fetch(`/api/plans/${plan.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        if (data.docsStatus || String(data.error || "").toLowerCase().includes("document")) {
          goDocuments();
        }
        throw new Error(data.error || data.detail || "Request failed");
      }
      if (data.plan) {
        setPlan(data.plan);
        if (data.plan.docsStatus) setDocsOverall(String(data.plan.docsStatus).toUpperCase());
      }

      if (action === "SET_PAYMENT_METHOD" && extra.paymentMethod === "INSTALLMENT") {
        setMsg("Installment selected. Opening Documents section to upload required files…");
        goDocuments();
      } else {
        setMsg(data.message || "Updated");
      }
      onUpdated?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  async function cancelPlan() {
    if (fullyPaid) {
      setMsg("This plan is fully paid and cannot be cancelled.");
      return;
    }
    setBusy("CANCEL_QUOTE");
    setMsg("");
    try {
      const quoteRes = await fetch(`/api/plans/${plan.id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL_QUOTE" }),
      });
      const quote = await readJson(quoteRes);
      const note = quote.message || "Cancellation may apply a fee on amounts already paid.";
      const reason =
        window.prompt(`${note}\n\nOptional reason for cancelling this plan:`) ?? null;
      if (reason === null) {
        setBusy("");
        return;
      }
      if (
        !window.confirm(
          "Cancel this plan permanently? Pending payments will be voided and the service may be released."
        )
      ) {
        setBusy("");
        return;
      }
      await act("CANCEL_CONFIRM", {
        reason: reason.trim() || "Cancelled by client",
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Cancel failed");
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

        {plan?.nextDueAt && isInstallment && (
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
              <p className="text-[11px] text-slate-500">
                After choosing installment you will be taken to <strong>Documents</strong> to upload
                required files. Payment unlocks after admin approval.
              </p>
            </div>
          </div>
        )}

        {isInstallment && (
          <div ref={docsRef} className="border-t pt-3 space-y-2">
            <div className="flex items-start gap-2 rounded-xl bg-primary-50 border border-primary-100 px-3 py-2.5">
              <FileText className="w-4 h-4 text-primary-700 shrink-0 mt-0.5" />
              <div className="text-xs text-primary-900">
                <p className="font-semibold">Step 1 — Documents</p>
                <p className="mt-0.5">
                  Upload installment documents in the <strong>Documents</strong> section (not on this
                  plan card). An admin must approve them before the first payment.
                </p>
              </div>
            </div>

            {firstInstallmentGate && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-950">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Payment locked until documents are approved</p>
                  <p className="mt-0.5">
                    Status: {docsOverall.replace(/_/g, " ")}. Open Documents to upload or update
                    files.
                  </p>
                </div>
              </div>
            )}

            {docsApproved && paid <= 0 && (
              <div className="flex items-start gap-2 rounded-xl bg-green-50 border border-green-100 px-3 py-2.5 text-xs text-green-900">
                <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Documents approved</p>
                  <p className="mt-0.5">You may proceed with the first installment payment.</p>
                </div>
              </div>
            )}

            {!docsApproved && (
              <a
                href="#documents"
                className="w-full min-h-[44px] rounded-xl bg-primary-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" /> Go to Documents to upload
              </a>
            )}
          </div>
        )}

        {!needsMethod && balance > 0 && (
          <div className="flex flex-col gap-2 border-t pt-3">
            {isInstallment && (
              <p className="text-xs font-semibold text-construction-dark">
                Step 2 — Payment {firstInstallmentGate ? "(available after document approval)" : ""}
              </p>
            )}
            <button
              type="button"
              disabled={!!busy || firstInstallmentGate}
              onClick={() => act("PAY_NOW")}
              className="w-full min-h-[44px] rounded-xl bg-accent-500 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy === "PAY_NOW" && <Loader2 className="w-4 h-4 animate-spin" />}
              {firstInstallmentGate ? (
                <>
                  <Lock className="w-4 h-4" /> Complete documents first
                </>
              ) : (
                "Pay now"
              )}
            </button>
            <button
              type="button"
              disabled={!!busy || firstInstallmentGate}
              onClick={() => act("PAY_REMAINING")}
              className="w-full min-h-[44px] rounded-xl border text-sm font-semibold disabled:opacity-50"
            >
              Pay remaining balance
            </button>
          </div>
        )}

        {canCancel && (
          <div className="border-t pt-3">
            <button
              type="button"
              disabled={!!busy}
              onClick={cancelPlan}
              className="w-full min-h-[44px] rounded-xl border border-red-200 text-red-700 text-sm font-semibold disabled:opacity-50 hover:bg-red-50"
            >
              {busy === "CANCEL_CONFIRM" ? "Cancelling…" : "Cancel this plan"}
            </button>
          </div>
        )}

        {fullyPaid && (
          <p className="text-[11px] text-green-700 font-medium border-t pt-3">
            Fully paid — this service can no longer be cancelled.
          </p>
        )}

        {msg && <p className="text-xs text-slate-600">{msg}</p>}
      </div>
    </div>
  );
}
