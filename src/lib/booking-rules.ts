/**
 * Hama Construction — reservation, installment, extension, cancel rules
 *
 * HOUSE / BUILDING / LAND:
 *   - Reservation hold: 7 days
 *   - Installment: WEEKLY | MONTHLY | QUARTERLY | YEARLY (user choice)
 *
 * Other services except WORKERS:
 *   - Reservation hold: 60 hours
 *   - Installment only within reservation window
 *   - Choosing installment extends hold by +24 hours
 *
 * WORKERS: full payment only
 * Cancel: 10% deduction; refund within 7 days
 */

export type BookingKind = "ASSET" | "TOOL" | "WORKER";

export const LONG_HOLD_CATEGORIES = new Set([
  "HOUSE",
  "BUILDING",
  "LAND",
  "APARTMENT",
]);

export const SHORT_HOLD_CATEGORIES = new Set([
  "HOTEL",
  "TOOLS",
  "TOOL",
  "COMMERCIAL",
  "OTHER",
]);

export const RESERVATION_HOURS = {
  LONG: 7 * 24,
  SHORT: 60,
  WORKERS: 12,
} as const;

export const INSTALLMENT_HOLD_EXTENSION_HOURS = 24;
export const CANCEL_DEDUCTION_PERCENT = 10;
export const REFUND_DAYS = 7;

export const INSTALLMENT_FREQUENCIES = [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "YEARLY",
] as const;

export type InstallmentFrequency = (typeof INSTALLMENT_FREQUENCIES)[number];

export function normalizeCategory(categoryOrType: string | null | undefined): string {
  return String(categoryOrType || "").toUpperCase().trim();
}

export function isWorkerCategory(categoryOrType: string | null | undefined): boolean {
  const c = normalizeCategory(categoryOrType);
  return c === "WORKERS" || c === "WORKER" || c === "LABOR";
}

export function isLongHoldCategory(categoryOrType: string | null | undefined): boolean {
  return LONG_HOLD_CATEGORIES.has(normalizeCategory(categoryOrType));
}

export function isShortHoldCategory(categoryOrType: string | null | undefined): boolean {
  const c = normalizeCategory(categoryOrType);
  if (isWorkerCategory(c) || isLongHoldCategory(c)) return false;
  return SHORT_HOLD_CATEGORIES.has(c) || (!!c && !isLongHoldCategory(c));
}

export function defaultReservationHours(categoryOrType: string | null | undefined): number {
  const c = normalizeCategory(categoryOrType);
  if (isWorkerCategory(c)) return RESERVATION_HOURS.WORKERS;
  if (isLongHoldCategory(c)) return RESERVATION_HOURS.LONG;
  return RESERVATION_HOURS.SHORT;
}

export function allowsInstallment(categoryOrType: string | null | undefined): boolean {
  const c = normalizeCategory(categoryOrType);
  if (!c || isWorkerCategory(c)) return false;
  return isLongHoldCategory(c) || isShortHoldCategory(c);
}

export function installmentAllowedForStatus(
  categoryOrType: string | null | undefined,
  status: string | null | undefined,
  amountPaid = 0,
  totalAmount = 0
): { ok: boolean; reason?: string } {
  if (isWorkerCategory(categoryOrType)) {
    return {
      ok: false,
      reason: "Worker hires require full payment. Installment is not available.",
    };
  }
  if (!allowsInstallment(categoryOrType)) {
    return {
      ok: false,
      reason: "Installment is not available for this service. Choose full payment.",
    };
  }
  const st = String(status || "").toUpperCase();
  if (["CANCELLED", "EXPIRED", "COMPLETED", "REFUNDED", "FULLY_PAID"].includes(st)) {
    return {
      ok: false,
      reason:
        "Installment can only be selected during the active reservation period.",
    };
  }
  if (totalAmount > 0 && amountPaid >= totalAmount) {
    return { ok: false, reason: "This booking is already fully paid." };
  }
  return { ok: true };
}

export function installmentExtendsHoldHours(categoryOrType: string | null | undefined): number {
  if (isShortHoldCategory(categoryOrType)) return INSTALLMENT_HOLD_EXTENSION_HOURS;
  return 0;
}

export function allowsExtension(kind: BookingKind, categoryOrType?: string | null): boolean {
  if (kind === "TOOL" || kind === "WORKER") return true;
  return normalizeCategory(categoryOrType) === "HOTEL";
}

export function extensionEligibleStatus(status: string | null | undefined, paid: boolean): boolean {
  const st = String(status || "").toUpperCase();
  if (["CANCELLED", "EXPIRED", "REFUNDED", "REJECTED"].includes(st)) return false;
  if (["FULLY_PAID", "CONFIRMED", "ACTIVE", "COMPLETED"].includes(st))
    return paid || st === "FULLY_PAID";
  return paid && ["CONFIRMED", "ACTIVE"].includes(st);
}

export const DEFAULT_EXTENSION = { feePercent: 10, maxDays: 30, minDays: 1 };

export function calcExtensionFee(opts: {
  baseAmount: number;
  dailyRate?: number;
  extraDays: number;
  feePercent?: number;
}): { fee: number; note: string } {
  const days = Math.max(1, Math.floor(opts.extraDays));
  const pct = opts.feePercent ?? DEFAULT_EXTENSION.feePercent;
  let fee = 0;
  if (opts.dailyRate && opts.dailyRate > 0) {
    fee = Math.round(opts.dailyRate * days * (1 + pct / 100) * 100) / 100;
  } else {
    fee = Math.round(opts.baseAmount * (pct / 100) * (days / 7) * 100) / 100;
    if (fee <= 0) fee = Math.round(opts.baseAmount * (pct / 100) * 100) / 100;
  }
  return {
    fee: Math.max(fee, 1),
    note: `Extension fee for ${days} day(s) includes ~${pct}% service surcharge.`,
  };
}

export function cancelRefundSummary(paidAmount: number): {
  percent: number;
  deducted: number;
  refundAmount: number;
  refundDays: number;
  message: string;
} {
  const percent = CANCEL_DEDUCTION_PERCENT;
  const deducted = Math.round((Math.max(0, paidAmount) * percent) / 100);
  const refundAmount = Math.max(0, paidAmount - deducted);
  return {
    percent,
    deducted,
    refundAmount,
    refundDays: REFUND_DAYS,
    message: `Cancellation deducts ${percent}%. Estimated refund ${refundAmount}. Refunds are processed within ${REFUND_DAYS} days.`,
  };
}
