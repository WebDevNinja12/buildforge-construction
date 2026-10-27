"use client";

import { useEffect, useState } from "react";
import { formatCountdown, isExpiringSoon } from "@/lib/countdown";

/** Live countdown. Pass ISO string from server components. */
export function Countdown({
  expiresAt,
  status,
  label = "Expires in",
  className = "",
  showWhenSettled = false,
}: {
  expiresAt?: string | Date | null;
  status?: string;
  label?: string;
  className?: string;
  /** If true, still show for CONFIRMED / FULLY_PAID as remaining time */
  showWhenSettled?: boolean;
}) {
  const iso =
    !expiresAt
      ? null
      : typeof expiresAt === "string"
        ? expiresAt
        : expiresAt.toISOString?.() || String(expiresAt);

  const [text, setText] = useState(() => (iso ? formatCountdown(iso) : ""));

  useEffect(() => {
    if (!iso) {
      setText("");
      return;
    }
    const tick = () => setText(formatCountdown(iso));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [iso]);

  if (!iso) return null;

  const settled = ["EXPIRED", "CANCELLED", "REFUNDED", "FULLY_PAID"].includes(status || "");
  if (status === "EXPIRED") {
    return (
      <span className={`inline-flex items-center text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded ${className}`}>
        Expired
      </span>
    );
  }
  if (settled && !showWhenSettled) return null;

  const urgent = isExpiringSoon(iso, 24);
  const overdue = text === "Expired";

  return (
    <span
      className={`inline-flex items-center text-xs font-semibold tabular-nums px-2 py-0.5 rounded ${
        overdue
          ? "text-red-700 bg-red-50"
          : urgent
            ? "text-amber-800 bg-amber-50"
            : "text-slate-700 bg-slate-100"
      } ${className}`}
      title={iso}
    >
      {overdue ? "Overdue / expired" : `${label} ${text}`}
    </span>
  );
}
