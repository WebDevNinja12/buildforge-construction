/** Payment schedule helpers */

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export function parseFrequencies(raw?: string | null): Frequency[] {
  try {
    const arr = JSON.parse(raw || '["MONTHLY"]');
    if (Array.isArray(arr) && arr.length) return arr as Frequency[];
  } catch { /* */ }
  return ["MONTHLY"];
}

export function addFrequency(date: Date, freq: Frequency, steps = 1): Date {
  const d = new Date(date);
  switch (freq) {
    case "DAILY":
      d.setDate(d.getDate() + steps);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + 7 * steps);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + steps);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3 * steps);
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + steps);
      break;
  }
  return d;
}

export function countPaymentsUntil(start: Date, end: Date, freq: Frequency): number {
  if (end <= start) return 1;
  let n = 0;
  let cursor = new Date(start);
  while (cursor < end && n < 500) {
    n++;
    cursor = addFrequency(cursor, freq, 1);
  }
  return Math.max(1, n);
}

/**
 * Installment structure (of plan total after any admin fee):
 *   - 1st payment: 40%
 *   - each following payment: 20% until fully paid (typically 4 payments: 40+20+20+20)
 * Frequency only controls due dates, not the split.
 */
export const FIRST_INSTALLMENT_PERCENT = 40;
export const NEXT_INSTALLMENT_PERCENT = 20;

export function buildSchedule(opts: {
  totalAmount: number;
  amountAlreadyPaid?: number;
  frequency: Frequency;
  startDate?: Date;
  planDeadline?: Date;
  firstIsDeposit?: boolean;
  depositPercent?: number;
}): { sequence: number; amount: number; dueDate: Date; percentOfTotal: number }[] {
  const total = Math.max(0, Number(opts.totalAmount) || 0);
  const paid = Math.max(0, Number(opts.amountAlreadyPaid) || 0);
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100);
  const start = opts.startDate || new Date();
  const rows: { sequence: number; amount: number; dueDate: Date; percentOfTotal: number }[] = [];

  if (remaining <= 0 || total <= 0) return rows;

  const firstTarget = Math.round(total * (FIRST_INSTALLMENT_PERCENT / 100) * 100) / 100;
  const nextTarget = Math.round(total * (NEXT_INSTALLMENT_PERCENT / 100) * 100) / 100;

  let still = remaining;
  let seq = 0;
  let dueOffset = 0;

  if (paid <= 0) {
    const amount = Math.min(still, firstTarget);
    still = Math.round((still - amount) * 100) / 100;
    seq++;
    rows.push({
      sequence: seq,
      amount,
      dueDate: addFrequency(start, opts.frequency, dueOffset),
      percentOfTotal: FIRST_INSTALLMENT_PERCENT,
    });
    dueOffset = 1;
  }

  while (still > 0.009 && seq < 50) {
    seq++;
    const isLast = still <= nextTarget + 0.01 || seq >= 49;
    const amount = isLast
      ? Math.round(still * 100) / 100
      : Math.min(still, nextTarget);
    still = Math.round((still - amount) * 100) / 100;
    rows.push({
      sequence: seq,
      amount,
      dueDate: addFrequency(start, opts.frequency, dueOffset),
      percentOfTotal: Math.round((amount / total) * 1000) / 10,
    });
    dueOffset++;
  }

  return rows;
}

export function cancelPercentForPlan(opts: {
  amountPaid: number;
  totalAmount: number;
  defaultPercent: number;
  beforeFirst?: number | null;
  afterHalf?: number | null;
}): number {
  if (opts.amountPaid <= 0 && opts.beforeFirst != null) return opts.beforeFirst;
  if (opts.totalAmount > 0 && opts.amountPaid / opts.totalAmount >= 0.5 && opts.afterHalf != null) {
    return opts.afterHalf;
  }
  return opts.defaultPercent;
}

export function parseImages(raw?: string | null): string[] {
  try {
    const arr = JSON.parse(raw || "[]");
    if (Array.isArray(arr)) return arr.filter((x) => typeof x === "string" && x);
  } catch { /* */ }
  return [];
}

export function mainImage(images: string[], mainIndex = 0): string | null {
  if (!images.length) return null;
  const i = Math.min(Math.max(0, mainIndex), images.length - 1);
  return images[i] || images[0];
}

export const PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=500&fit=crop";
