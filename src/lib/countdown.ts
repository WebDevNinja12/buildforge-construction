/** Parse many date shapes from API / Prisma JSON */
export function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  if (!s) return null;
  // numeric string timestamp
  if (/^\d{10,13}$/.test(s)) {
    const n = Number(s);
    const d = new Date(s.length <= 10 ? n * 1000 : n);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type CountdownParts = {
  totalMs: number;
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Clock string e.g. "2d 14:05:09" or "00:45:12" */
  clock: string;
  label: string;
};

/** Live digital-clock breakdown until a deadline */
export function getCountdownParts(
  expiresAt: Date | string | number | null | undefined
): CountdownParts {
  const end = toDate(expiresAt);
  if (!end) {
    return {
      totalMs: 0,
      expired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      clock: "--:--:--",
      label: "No deadline",
    };
  }
  const ms = end.getTime() - Date.now();
  if (ms <= 0) {
    return {
      totalMs: 0,
      expired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      clock: "00:00:00",
      label: "Expired",
    };
  }
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const clock = days > 0 ? `${days}d ${hms}` : hms;
  return {
    totalMs: ms,
    expired: false,
    days,
    hours,
    minutes,
    seconds,
    clock,
    label: clock,
  };
}

/** Format remaining time until a date as clock "3d 04:20:05" or "Expired" */
export function formatCountdown(expiresAt: Date | string | number | null | undefined): string {
  const p = getCountdownParts(expiresAt);
  if (p.label === "No deadline") return "—";
  if (p.expired) return "Expired";
  return p.clock;
}

export function isExpiringSoon(
  expiresAt: Date | string | number | null | undefined,
  withinHours = 24
): boolean {
  const p = getCountdownParts(expiresAt);
  if (p.expired || p.label === "No deadline") return false;
  return p.totalMs > 0 && p.totalMs <= withinHours * 3600 * 1000;
}
