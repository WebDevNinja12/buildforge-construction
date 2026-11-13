/**
 * Hama Construction — reservation, installment, extension, cancel rules
 *
 * HOUSE / BUILDING / LAND (and similar long-hold assets):
 *   - Reservation hold: 7 days
 *   - Installment allowed; frequency = WEEKLY | MONTHLY | QUARTERLY | YEARLY (user choice)
 *
 * Other services except WORKERS (hotel, tools, commercial short-hold, etc.):
 *   - Reservation hold: 60 hours
 *   - Installment may be chosen only within that reservation window
 *   - Choosing installment extends the reservation hold by +24 hours
 *
 * WORKERS:
 *   - No installment; full payment only
 *
 * Cancel (any service):
 *   - 10% deduction
 *   - Refund processed within 7 days
 *
 * House & Land only:
 *   - Pay NGN 50,000 reservation fee to fully lock the hold (CONFIRMED)
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

/** House & Land only: pay this amount to fully lock the reservation hold */
export const HOUSE_LAND_RESERVATION_FEE = 50_000;

export function reservationHoldFee(categoryOrType: string | null | undefined): number {
  const c = normalizeCategory(categoryOrType);
  if (c === "HOUSE" || c === "LAND") return HOUSE_LAND_RESERVATION_FEE;
  return 0;
}

export function isHouseOrLand(categoryOrType: string | null | undefined): boolean {
  const c = normalizeCategory(categoryOrType);
  return c === "HOUSE" || c === "LAND";
}

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

export function allowsInstallment(categoryOrType: string | null | undefined): {
  ok: boolean;
  reason?: string;
} {
  if (isWorkerCategory(categoryOrType)) {
    return {
      ok: false,
      reason: "Worker hires require full payment. Installment is not available.",
    };
  }
  return { ok: true };
}

export function installmentAllowedForStatus(
  categoryOrType: string | null | undefined,
  status: string | null | undefined,
  expiresAt?: Date | string | null
): { ok: boolean; reason?: string } {
  const allow = allowsInstallment(categoryOrType);
  if (!allow.ok) return allow;
  const st = String(status || "").toUpperCase();
  if (["CANCELLED", "EXPIRED", "FULLY_PAID", "COMPLETED", "REFUNDED"].includes(st)) {
    return {
      ok: false,
      reason:
        "Installment can only be selected during the active reservation period. After full payment, use extension if available.",
    };
  }
  if (expiresAt) {
    const exp = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      return { ok: false, reason: "Reservation period has expired." };
    }
  }
  return { ok: true };
}

export function installmentExtendsHoldHours(categoryOrType: string | null | undefined): number {
  if (isShortHoldCategory(categoryOrType)) return INSTALLMENT_HOLD_EXTENSION_HOURS;
  return 0;
}

/** Plan admin fee on choosing installment — NOT interest */
export const INSTALLMENT_ADMIN_FEE = {
  LONG_HOLD_PERCENT: 5,
  SHORT_HOLD_PERCENT: 1,
} as const;

export function installmentAdminFeePercent(categoryOrType: string | null | undefined): number {
  if (isWorkerCategory(categoryOrType)) return 0;
  if (isLongHoldCategory(categoryOrType)) return INSTALLMENT_ADMIN_FEE.LONG_HOLD_PERCENT;
  return INSTALLMENT_ADMIN_FEE.SHORT_HOLD_PERCENT;
}

export function applyInstallmentAdminFee(
  baseAmount: number,
  categoryOrType: string | null | undefined
): { total: number; fee: number; percent: number; note: string } {
  const percent = installmentAdminFeePercent(categoryOrType);
  const fee = Math.round(baseAmount * (percent / 100) * 100) / 100;
  return {
    total: Math.round((baseAmount + fee) * 100) / 100,
    fee,
    percent,
    note:
      percent > 0
        ? `${percent}% admin fee on installment plan (not interest). Added to the plan total.`
        : "No installment admin fee.",
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

export function extensionFee(opts: {
  baseAmount: number;
  days: number;
  categoryOrType?: string | null;
}): { fee: number; note: string } {
  const pct = 5;
  const days = Math.max(1, Math.floor(opts.days || 1));
  let fee = Math.round(opts.baseAmount * (pct / 100) * (days / 7) * 100) / 100;
  if (fee <= 0) fee = Math.round(opts.baseAmount * (pct / 100) * 100) / 100;
  return {
    fee: Math.max(fee, 1),
    note: `Extension fee for ${days} day(s) includes ~${pct}% service surcharge. Separate from installment plan rules.`,
  };
}
