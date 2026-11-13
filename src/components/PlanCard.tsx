"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency, PAYMENT_METHOD_LABEL } from "@/lib/utils";
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
  const [stayNights, setStayNights] = useState(1);
  const [stayIn, setStayIn] = useState("");
  const [stayOut, setStayOut] = useState("");
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
  const statusUpper = String(plan?.status || "").toUpperCase();
  const assetType = String(plan?.asset?.type || plan?.assetType || "HOUSE").toUpperCase();
  const fullyPaid =
    balance <= 0.01 ||
    ["FULLY_PAID", "COMPLETED"].includes(statusUpper);
  const showInstallmentOption = !["WORKERS", "WORKER", "LABOR"].includes(assetType);
  const canCancel =
    !fullyPaid &&
    !["CANCELLED", "EXPIRED", "FULLY_PAID", "COMPLETED", "REFUNDED"].includes(statusUpper);
  const canSetStay =
    assetType === "HOTEL" &&
    !["CANCELLED", "EXPIRED", "FULLY_PAID", "COMPLETED"].includes(statusUpper);

  const installments = Array.isArray(plan?.installments)
    ? plan.installments
    : (() => {
        try {
          const raw = plan?.scheduleJson;
          if (!raw) return [];
          const data = typeof raw === "string" ? JSON.parse(raw) : raw;
          return Array.isArray(data) ? data : [];
        } catch {
          return [];
        }
      })();
  const next = installments.find((i: any) => (i.status || "PENDING") === "PENDING");

  const houseLandFee = ["HOUSE", "LAND"].includes(assetType) ? 50_000 : 0;
  const needsReservationFee =
    houseLandFee > 0 && paid + 0.01 < houseLandFee && !fullyPaid &&
    !["CANCELLED", "EXPIRED", "REFUNDED"].includes(statusUpper);

  const docsApproved = ["APPROVED"].includes(docsOverall);
  const firstInstallmentGate = isInstallment && paid <= 0 && !docsApproved;

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
          "First-time installment: upload documents in Documents section first. Returning clients with approved docs can pay immediately."
        );
        if (typeof window !== "undefined") {
          window.location.hash = "documents";
        }
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
          if (typeof window !== "undefined") window.location.hash = "documents";
        }
        throw new Error(data.error || data.detail || "Request failed");
      }
      if (data.plan) {
        setPlan(data.plan);
        if (data.plan.docsStatus) setDocsOverall(String(data.plan.docsStatus).toUpperCase());
      }
      if (action === "SET_PAYMENT_METHOD" && extra.paymentMethod === "INSTALLMENT") {
        if (data.redirectToDocs) {
          setMsg(data.message || "Installment selected. Upload documents next.");
          if (typeof window !== "undefined") window.location.hash = "documents";
        } else {
          setMsg(data.message || "Installment selected (bank transfer).");
        }
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

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      {plan?.asset?.imageUrl || plan?.asset?.images?.[0] ? (
        <ServiceImage
          src={plan?.asset?.imageUrl || plan?.asset?.images?.[0]}
          alt={plan?.asset?.title || "Service"}
          className="h-36 w-full object-cover"
        />
      ) : null}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-construction-dark truncate">
              {plan?.asset?.title || plan?.title || "Reservation"}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {assetType}
              {plan?.status ? ` · ${String(plan.status).replace(/_/g, " ")}` : ""}
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-slate-100 text-slate-700 shrink-0">
            {needsMethod
              ? "Choose plan type below"
              : isInstallment
                ? `Installment · ${PAYMENT_METHOD_LABEL}`
                : `Full payment · ${PAYMENT_METHOD_LABEL}`}
          </span>
        </div>

        {needsReservationFee && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-950">
            <p className="font-semibold">House / Land reservation fee</p>
            <p className="mt-0.5">
              Pay {formatCurrency(houseLandFee)} by {PAYMENT_METHOD_LABEL} to fully lock this reservation.
            </p>
          </div>
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

        {canSetStay && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-semibold text-construction-dark">Hotel stay period</p>
            <p className="text-[11px] text-slate-500">
              Choose dates or nights. Fee = nights × nightly rate ({formatCurrency(plan?.asset?.price || 0)}) — calculated before you pay.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={stayIn} onChange={(e) => setStayIn(e.target.value)} className="border rounded-xl px-3 min-h-[40px] text-sm" />
              <input type="date" value={stayOut} onChange={(e) => setStayOut(e.target.value)} className="border rounded-xl px-3 min-h-[40px] text-sm" />
            </div>
            <input
              type="number"
              min={1}
              max={90}
              value={stayNights}
              onChange={(e) => setStayNights(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="w-full border rounded-xl px-3 min-h-[40px] text-sm"
              placeholder="Nights"
            />
          </div>
        )}

        {needsMethod && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm font-semibold text-construction-dark">Choose plan type</p>
            <p className="text-[11px] text-slate-500">
              Settlement is always <strong>{PAYMENT_METHOD_LABEL}</strong>. Transfer to the company account, then submit payment for admin approval.
            </p>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => act("SET_PAYMENT_METHOD", { paymentMethod: "FULL" })}
              className="w-full min-h-[44px] rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {busy === "SET_PAYMENT_METHOD" ? "Saving…" : "Full payment (bank transfer)"}
            </button>
            {showInstallmentOption ? (
              <div className="space-y-2">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full border rounded-xl px-3 min-h-[44px] text-sm"
                >
                  {["MONTHLY", "WEEKLY", "QUARTERLY", "YEARLY"].map((f) => (
                    <option key={f} value={f}>{f}</option>
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
                  Installment plan (bank transfer)
                </button>
                <div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2 text-[11px] text-sky-950 space-y-1">
                  <p className="font-semibold">Installment structure</p>
                  <p>
                    First payment <strong>40%</strong> of the plan total, then <strong>20%</strong> each until fully paid.
                  </p>
                  <p>
                    House / building / land: <strong>5%</strong> plan administration fee. Other installment services: <strong>1%</strong>. <strong>This is not interest</strong>.
                  </p>
                  <p>All installments are settled by <strong>{PAYMENT_METHOD_LABEL}</strong>.</p>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Workers: full payment only via {PAYMENT_METHOD_LABEL}.</p>
            )}
          </div>
        )}

        {isInstallment && !needsMethod && (
          <div ref={docsRef} className="space-y-2 border-t pt-3">
            <div className="flex items-start gap-2 rounded-xl bg-primary-50 border border-primary-100 px-3 py-2.5">
              <FileText className="w-4 h-4 text-primary-700 shrink-0 mt-0.5" />
              <div className="text-xs text-primary-900">
                <p className="font-semibold">Step 1 — Documents</p>
                <p className="mt-0.5">
                  Required only the <strong>first time</strong> you use an installment plan. Upload in <strong>Documents</strong>; admin approval unlocks payment.
                </p>
              </div>
            </div>
            {firstInstallmentGate && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-xs text-amber-950">
                <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Payment locked until documents are approved</p>
                  <p className="mt-0.5">Status: {docsOverall.replace(/_/g, " ")}.</p>
                </div>
              </div>
            )}
            {docsApproved && paid <= 0 && (
              <div className="flex items-start gap-2 rounded-xl bg-green-50 border border-green-100 px-3 py-2.5 text-xs text-green-900">
                <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Documents approved</p>
                  <p className="mt-0.5">You may proceed with the first installment via {PAYMENT_METHOD_LABEL}.</p>
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
            <p className="text-[11px] text-slate-500 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
              Pay by <strong>{PAYMENT_METHOD_LABEL}</strong> only. After transfer, submit here for admin confirmation.
            </p>
            {isInstallment && (
              <p className="text-xs font-semibold text-construction-dark">
                Step 2 — Payment {firstInstallmentGate ? "(available after document approval)" : ""}
              </p>
            )}
            <button
              type="button"
              disabled={!!busy || firstInstallmentGate}
              onClick={() => act(isInstallment ? "PAY_INSTALLMENT" : "PAY_NOW")}
              className="w-full min-h-[44px] rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {busy.startsWith("PAY") ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                </span>
              ) : isInstallment ? (
                `Pay next installment (${PAYMENT_METHOD_LABEL})`
              ) : (
                `Pay now (${PAYMENT_METHOD_LABEL})`
              )}
            </button>
            {balance > 0 && (
              <button
                type="button"
                disabled={!!busy || firstInstallmentGate}
                onClick={() => act("PAY_REMAINING")}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Pay remaining balance
              </button>
            )}
          </div>
        )}

        {canCancel && (
          <button
            type="button"
            disabled={!!busy}
            onClick={async () => {
              const q = await fetch(`/api/plans/${plan.id}`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "CANCEL_QUOTE" }),
              });
              const quote = await readJson(q);
              const note = quote.message || "Cancellation may apply a fee on amounts already paid.";
              if (!window.confirm(`${note}\n\nConfirm cancel?`)) return;
              await act("CANCEL_CONFIRM", { reason: "Client cancelled" });
            }}
            className="w-full min-h-[40px] rounded-xl text-xs font-semibold text-red-700 border border-red-100 hover:bg-red-50 disabled:opacity-50"
          >
            Cancel reservation
          </button>
        )}

        {msg && (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2">{msg}</p>
        )}
      </div>
    </div>
  );
}
