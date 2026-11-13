import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Settlement channel for all client payments */
export const PAYMENT_METHOD_LABEL = "Bank Transfer";
export const PAYMENT_METHOD_CODE = "BANK_TRANSFER";

export function formatCurrency(amount: number | null | undefined, currency = "NGN") {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "₦0";
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
  }
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "—";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return "—";
  }
}

export function statusBadgeClass(status?: string | null) {
  const s = (status || "").toUpperCase();
  if (["APPROVED", "VERIFIED", "COMPLETED", "FULLY_PAID", "ACTIVE", "CONFIRMED"].includes(s)) {
    return "bg-green-100 text-green-800";
  }
  if (["REJECTED", "OVERDUE", "SUSPENDED", "CANCELLED", "EXPIRED", "FAILED"].includes(s)) {
    return "bg-red-100 text-red-800";
  }
  if (["PENDING", "UNDER_REVIEW", "PENDING_APPROVAL", "INCOMPLETE", "ACTION_NEEDED"].includes(s)) {
    return "bg-amber-100 text-amber-900";
  }
  return "bg-slate-100 text-slate-700";
}

export const ASSET_TYPES = [
  { value: "HOUSE", label: "House" },
  { value: "HOTEL", label: "Hotel" },
  { value: "LAND", label: "Land" },
  { value: "APARTMENT", label: "Apartment" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "BUILDING", label: "Building" },
];
