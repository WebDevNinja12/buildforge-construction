"use client";

import { useEffect, useState } from "react";
import { getCountdownParts, isExpiringSoon, toDate } from "@/lib/countdown";

/**
 * Live ticking countdown clock (updates every second).
 * Shows digital time like 02:15:09 or 3d 14:05:09.
 */
export function Countdown({
  expiresAt,
  status,
  label = "Expires in",
  className = "",
  showWhenSettled = false,
  variant = "badge",
}: {
  expiresAt?: string | Date | number | null;
  status?: string;
  label?: string;
  className?: string;
  showWhenSettled?: boolean;
  /** badge = compact chip; clock = large digital display */
  variant?: "badge" | "clock";
}) {
  const end = toDate(expiresAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!end) return;
    // Align ticks to whole seconds so the clock feels smooth
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [end?.getTime()]);

  if (!end) return null;

  const settled = ["EXPIRED", "CANCELLED", "REFUNDED", "FULLY_PAID", "COMPLETED"].includes(
    (status || "").toUpperCase()
  );
  if ((status || "").toUpperCase() === "EXPIRED") {
    return (
      <span
        className={`inline-flex items-center text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg ${className}`}
      >
        Expired
      </span>
    );
  }
  if (settled && !showWhenSettled) return null;

  // recompute from `now` so React re-renders the digits each second
  void now;
  const parts = getCountdownParts(end);
  const urgent = isExpiringSoon(end, 24);
  const overdue = parts.expired;

  if (variant === "clock") {
    return (
      <div
        className={`rounded-2xl border px-4 py-3 ${className} ${
          overdue
            ? "border-red-200 bg-red-50"
            : urgent
              ? "border-amber-200 bg-amber-50"
              : "border-slate-200 bg-slate-50"
        }`}
      >
        <p className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
        <p
          className={`mt-1 font-mono text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${
            overdue ? "text-red-700" : urgent ? "text-amber-800" : "text-construction-dark"
          }`}
          suppressHydrationWarning
        >
          {overdue ? "00:00:00" : parts.clock}
        </p>
        {overdue && <p className="text-xs text-red-600 mt-1 font-semibold">Time expired</p>}
      </div>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums px-2.5 py-1 rounded-lg ${className} ${
        overdue
          ? "text-red-700 bg-red-50"
          : urgent
            ? "text-amber-800 bg-amber-50"
            : "text-slate-800 bg-slate-100"
      }`}
      title={end.toISOString()}
      suppressHydrationWarning
    >
      <span className="opacity-70 font-medium">{overdue ? "Status" : label}</span>
      <span className="font-mono text-sm font-bold">
        {overdue ? "Expired" : parts.clock}
      </span>
    </span>
  );
}
