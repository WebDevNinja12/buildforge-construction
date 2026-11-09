/**
 * Booking payment & extension rules (Hama Construction)
 *
 * Installment: only HOTEL and TOOLS, and only during the reservation/hold period
 * (before the booking is fully paid / completed).
 * Workers and all other asset types (HOUSE, LAND, etc.): full payment only.
 *
 * Extension: after a full/confirmed booking for HOTEL, TOOLS, or WORKERS —
 * client may request more days from the dashboard. Extension fees are separate
 * from installment rules.
 */

export type BookingKind = "ASSET" | "TOOL" | "WORKER";

const INSTALLMENT_CATEGORIES = new Set(["HOTEL", "TOOLS", "TOOL"]);

export function allowsInstallment(categoryOrType: string | null | undefined): boolean {
  const c = String(categoryOrType || "").toUpperCase().trim();
  return INSTALLMENT_CATEGORIES.has(c);
}

export function isWorkerCategory(categoryOrType: string | null | undefined): boolean {
  const c = String(categoryOrType || "").toUpperCase().trim();
  return c === "WORKERS" || c === "WORKER" || c === "LABOR";
}

export function installmentAllowedForStatus(
  categoryOrType: string | null | undefined,
  status: string | null | undefined,
  amountPaid = 0,
  totalAmount = 0
): { ok: boolean; reason?: string } {
  if (!allowsInstallment(categoryOrType)) {
    return {
      ok: false,
      reason:
        "Installment payment is only available for hotel and tool bookings during the reservation period. This service requires full payment.",
    };
  }
  const st = String(status || "").toUpperCase();
  if (["CANCELLED", "EXPIRED", "COMPLETED", "REFUNDED", "FULLY_PAID"].includes(st)) {
    return {
      ok: false,
      reason: "Installment is only available during the active reservation period.",
    };
  }
  if (totalAmount > 0 && amountPaid >= totalAmount) {
    return {
      ok: false,
      reason: "This booking is already fully paid. Use extension if you need more time.",
    };
  }
  return { ok: true };
}

export function allowsExtension(kind: BookingKind, categoryOrType?: string | null): boolean {
  if (kind === "TOOL" || kind === "WORKER") return true;
  const c = String(categoryOrType || "").toUpperCase();
  return c === "HOTEL";
}

export function extensionEligibleStatus(status: string | null | undefined, paid: boolean): boolean {
  const st = String(status || "").toUpperCase();
  if (["CANCELLED", "EXPIRED", "REFUNDED", "REJECTED"].includes(st)) return false;
  if (["FULLY_PAID", "CONFIRMED", "ACTIVE", "COMPLETED"].includes(st)) return paid || st === "FULLY_PAID";
  return paid && ["CONFIRMED", "ACTIVE"].includes(st);
}

export const DEFAULT_EXTENSION = {
  feePercent: 10,
  maxDays: 30,
  minDays: 1,
};

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
    note: `Extension fee for ${days} day(s) includes ~${pct}% service surcharge. This is separate from installment plan rules.`,
  };
}
