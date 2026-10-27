/** Payment schedule helpers */

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export function parseFrequencies(raw?: string | null): Frequency[] {
  try {
    const arr = JSON.parse(raw || "[\"MONTHLY\"]");
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

/** Build equal installment rows for remaining balance */
export function buildSchedule(opts: {
  totalAmount: number;
  amountAlreadyPaid?: number;
  frequency: Frequency;
  startDate?: Date;
  planDeadline: Date;
  firstIsDeposit?: boolean;
  depositPercent?: number;
}): { sequence: number; amount: number; dueDate: Date }[] {
  const paid = opts.amountAlreadyPaid || 0;
  const remaining = Math.max(0, opts.totalAmount - paid);
  const start = opts.startDate || new Date();
  const count = countPaymentsUntil(start, opts.planDeadline, opts.frequency);
  const rows: { sequence: number; amount: number; dueDate: Date }[] = [];

  if (remaining <= 0) return rows;

  const each = Math.round((remaining / count) * 100) / 100;
  let allocated = 0;
  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const amount = isLast
      ? Math.round((remaining - allocated) * 100) / 100
      : each;
    allocated += amount;
    rows.push({
      sequence: i + 1,
      amount,
      dueDate: addFrequency(start, opts.frequency, i + 1),
    });
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
