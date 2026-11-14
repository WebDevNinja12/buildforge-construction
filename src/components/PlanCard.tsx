"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatCurrency,
  PAYMENT_METHOD_LABEL,
  BANK_TRANSFER_DETAILS,
} from "@/lib/utils";
import { Countdown } from "@/components/Countdown";
import { ServiceImage } from "@/components/ServiceImage";
import {
  FileText,
  Loader2,
  Lock,
  CheckCircle2,
  Landmark,
  Copy,
} from "lucide-react";

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
  const [showBankPay, setShowBankPay] = useState(false);
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [payAction, setPayAction] = useState<
    "PAY_NOW" | "PAY_INSTALLMENT" | "PAY_REMAINING"
  >("PAY_NOW");
  const [copied, setCopied] = useState("");
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
    balance <= 0.01 || ["FULLY_PAID", "COMPLETED"].includes(statusUpper);
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
    houseLandFee > 0 &&
    paid + 0.01 < houseLandFee &&
    !fullyPaid &&
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
        if (typeof window !== "undefined") window.location.hash = "documents";
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
      if (action.startsWith("PAY")) setShowBankPay(false);
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

  function openBankPay(
    action: "PAY_NOW" | "PAY_INSTALLMENT" | "PAY_REMAINING",
    amount: number
  ) {
    setPayAction(action);
    setPayAmount(amount);
    setShowBankPay(true);
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
              Pay {formatCurrency(houseLandFee)} by {PAYMENT_METHOD_LABEL} to fully lock this
              reservation.
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
              Choose dates or nights. Fee = nights × nightly rate (
              {formatCurrency(plan?.asset?.price || 0)}) — calculated before you pay.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={stayIn}
                onChange={(e) => setStayIn(e.target.value)}
                className="border rounded-xl px-3 min-h-[40px] text-sm"
              />
              <input
                type="date"
                value={stayOut}
                onChange={(e) => setStayOut(e.target.value)}
                className="border rounded-xl px-3 min-h-[40px] text-sm"
              />
            </div>
            <input
              type="number"
              min={1}
              max={90}
              value={stayNights}
              onChange={(e) =>
                setStayNights(Math.max(1, Math.floor(Number(e.target.value) || 1)))
              }
              className="w-full border rounded-xl px-3 min-h-[40px] text-sm"
              placeholder="Nights"
            />
          </div>
        )}

        {needsMethod && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm font-semibold text-construction-dark">Choose plan type</p>
            <p className="text-[11px] text-slate-500">
              Settlement is always <strong>{PAYMENT_METHOD_LABEL}</strong>. Transfer to the company
              account, then confirm on this screen.
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
                  Installment plan (bank transfer)
                </button>
                <div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2 text-[11px] text-sky-950 space-y-1">
                  <p className="font-semibold">Installment structure</p>
                  <p>
                    First payment <strong>40%</strong>, then <strong>20%</strong> each until paid.
                  </p>
                  <p>
                    House / land: <strong>5%</strong> admin fee. Other services: <strong>1%</strong>.
                    Not interest.
                  </p>
                  <p>
                    Paid only by <strong>{PAYMENT_METHOD_LABEL}</strong>.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Workers: full payment only via {PAYMENT_METHOD_LABEL}.
              </p>
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
                  Required the first time you use installment. Upload under Documents; approval unlocks
                  payment.
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
                <p className="font-semibold">Documents approved — you can pay by bank transfer.</p>
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
                Step 2 — Bank transfer payment{" "}
                {firstInstallmentGate ? "(after document approval)" : ""}
              </p>
            )}

            {firstInstallmentGate ? (
              <button
                type="button"
                disabled
                className="w-full min-h-[44px] rounded-xl bg-slate-200 text-slate-500 text-sm font-semibold inline-flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" /> Complete documents first
              </button>
            ) : !showBankPay ? (
              <>
                <p className="text-[11px] text-slate-500 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
                  All payments use <strong>{PAYMENT_METHOD_LABEL}</strong>. Open transfer details, pay the
                  exact amount, then confirm.
                </p>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => {
                    const amt = isInstallment
                      ? Number(next?.amount || total * 0.4)
                      : balance || total;
                    openBankPay(isInstallment ? "PAY_INSTALLMENT" : "PAY_NOW", amt);
                  }}
                  className="w-full min-h-[48px] rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <Landmark className="w-4 h-4" />
                  Pay with bank transfer
                  {isInstallment && next ? ` · ${formatCurrency(Number(next.amount))}` : ""}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => openBankPay("PAY_REMAINING", balance || total)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-50"
                >
                  Pay remaining · {formatCurrency(balance)}
                </button>
              </>
            ) : (
              <div className="rounded-xl border-2 border-primary-300 bg-primary-50/50 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-construction-dark flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-primary-700" />
                    {PAYMENT_METHOD_LABEL}
                  </p>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-slate-500"
                    onClick={() => setShowBankPay(false)}
                  >
                    Close
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  Transfer <strong>{formatCurrency(payAmount ?? balance)}</strong> to this account:
                </p>
                <dl className="space-y-2 text-sm bg-white border border-slate-200 rounded-xl px-3 py-3">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500 text-xs">Bank</dt>
                    <dd className="font-semibold text-right">{BANK_TRANSFER_DETAILS.bankName}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500 text-xs">Account name</dt>
                    <dd className="font-semibold text-right">{BANK_TRANSFER_DETAILS.accountName}</dd>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <dt className="text-slate-500 text-xs">Account number</dt>
                    <dd className="font-semibold inline-flex items-center gap-1">
                      {BANK_TRANSFER_DETAILS.accountNumber}
                      <button
                        type="button"
                        className="text-primary-700 p-1"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              BANK_TRANSFER_DETAILS.accountNumber
                            );
                            setCopied("acct");
                            setTimeout(() => setCopied(""), 1500);
                          } catch {
                            /* */
                          }
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {copied === "acct" && (
                        <span className="text-[10px] text-emerald-700">Copied</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 border-t pt-2">
                    <dt className="text-slate-500 text-xs">Amount</dt>
                    <dd className="font-bold text-primary-800">
                      {formatCurrency(payAmount ?? balance)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500 text-xs">Payment reference</dt>
                    <dd className="font-mono text-xs text-right">
                      {(plan?.id || "").slice(0, 10).toUpperCase()}
                    </dd>
                  </div>
                </dl>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {BANK_TRANSFER_DETAILS.instructions}
                </p>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => act(payAction, { amount: payAmount ?? undefined })}
                  className="w-full min-h-[48px] rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {busy.startsWith("PAY") ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>Confirm bank transfer · {formatCurrency(payAmount ?? balance)}</>
                  )}
                </button>
              </div>
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
              const note =
                quote.message || "Cancellation may apply a fee on amounts already paid.";
              if (!window.confirm(`${note}\n\nConfirm cancel?`)) return;
              await act("CANCEL_CONFIRM", { reason: "Client cancelled" });
            }}
            className="w-full min-h-[40px] rounded-xl text-xs font-semibold text-red-700 border border-red-100 hover:bg-red-50 disabled:opacity-50"
          >
            Cancel reservation
          </button>
        )}

        {msg && (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
