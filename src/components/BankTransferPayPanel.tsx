"use client";

import { useState } from "react";
import { Copy, Landmark, Loader2 } from "lucide-react";
import {
  formatCurrency,
  PAYMENT_METHOD_LABEL,
  BANK_TRANSFER_DETAILS,
} from "@/lib/utils";

type Props = {
  amount: number;
  /** Short reference shown to the client (e.g. plan/booking id) */
  reference?: string;
  /** Label on confirm button */
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  className?: string;
};

/**
 * Shared bank-transfer instructions + confirm action.
 * Used by plan cards, tool rentals, worker hires, and extensions.
 */
export function BankTransferPayPanel({
  amount,
  reference,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
  className = "",
}: Props) {
  const [copied, setCopied] = useState(false);
  const amt = Number(amount) || 0;

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(BANK_TRANSFER_DETAILS.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* */
    }
  }

  return (
    <div
      className={`rounded-xl border-2 border-primary-300 bg-primary-50/50 p-3 space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-construction-dark flex items-center gap-1.5">
          <Landmark className="w-4 h-4 text-primary-700" />
          {PAYMENT_METHOD_LABEL}
        </p>
        {onCancel && (
          <button
            type="button"
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            onClick={onCancel}
          >
            Close
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600">
        Transfer <strong>{formatCurrency(amt)}</strong> to this account, then confirm below.
      </p>

      <dl className="space-y-2 text-sm bg-white border border-slate-200 rounded-xl px-3 py-3">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500 text-xs">Bank</dt>
          <dd className="font-semibold text-right text-construction-dark">
            {BANK_TRANSFER_DETAILS.bankName}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500 text-xs">Account name</dt>
          <dd className="font-semibold text-right text-construction-dark">
            {BANK_TRANSFER_DETAILS.accountName}
          </dd>
        </div>
        <div className="flex justify-between items-center gap-2">
          <dt className="text-slate-500 text-xs">Account number</dt>
          <dd className="font-semibold text-construction-dark inline-flex items-center gap-1">
            {BANK_TRANSFER_DETAILS.accountNumber}
            <button
              type="button"
              className="text-primary-700 p-1"
              title="Copy account number"
              onClick={copyAccount}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            {copied && <span className="text-[10px] text-emerald-700">Copied</span>}
          </dd>
        </div>
        <div className="flex justify-between gap-2 border-t border-slate-100 pt-2">
          <dt className="text-slate-500 text-xs">Amount</dt>
          <dd className="font-bold text-primary-800">{formatCurrency(amt)}</dd>
        </div>
        {reference ? (
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500 text-xs">Payment reference</dt>
            <dd className="font-mono text-xs text-right text-slate-700">
              {String(reference).slice(0, 12).toUpperCase()}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        {BANK_TRANSFER_DETAILS.instructions}
      </p>

      <button
        type="button"
        disabled={!!busy || !(amt > 0)}
        onClick={() => void onConfirm()}
        className="w-full min-h-[48px] rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
          </>
        ) : (
          confirmLabel || `Confirm bank transfer · ${formatCurrency(amt)}`
        )}
      </button>
    </div>
  );
}
