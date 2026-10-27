"use client";

import { useEffect, useState } from "react";
import { formatCountdown, isExpiringSoon } from "@/lib/countdown";

export function Countdown({
  expiresAt,
  status,
  className = "",
}: {
  expiresAt?: string | Date | null;
  status?: string;
  className?: string;
}) {
  const [label, setLabel] = useState(() => formatCountdown(expiresAt));

  useEffect(() => {
    if (!expiresAt || status === "EXPIRED" || status === "CANCELLED" || status === "FULLY_PAID" || status === "CONFIRMED") {
      setLabel(status === "EXPIRED" ? "Expired" : formatCountdown(expiresAt));
      return;
    }
    const tick = () => setLabel(formatCountdown(expiresAt));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [expiresAt, status]);

  if (!expiresAt) return null;
  if (status === "EXPIRED") {
    return <span className={`text-xs font-medium text-red-600 ${className}`}>Expired</span>;
  }
  if (["CONFIRMED", "FULLY_PAID", "CANCELLED"].includes(status || "")) return null;

  const urgent = isExpiringSoon(expiresAt, 24);
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${
        urgent ? "text-amber-600" : "text-slate-600"
      } ${className}`}
      title={typeof expiresAt === "string" ? expiresAt : expiresAt?.toISOString()}
    >
      Expires in {label}
    </span>
  );
}
