/** Format remaining time until a date as "3d 4h 20m 05s" or "Expired" */
export function formatCountdown(expiresAt: Date | string | null | undefined): string {
  if (!expiresAt) return "—";
  const end = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(end.getTime())) return "—";
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${hours}h ${pad(mins)}m`;
  if (hours > 0) return `${hours}h ${pad(mins)}m ${pad(secs)}s`;
  return `${mins}m ${pad(secs)}s`;
}

export function isExpiringSoon(expiresAt: Date | string | null | undefined, withinHours = 24): boolean {
  if (!expiresAt) return false;
  const end = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(end.getTime())) return false;
  const ms = end.getTime() - Date.now();
  return ms > 0 && ms <= withinHours * 3600 * 1000;
}
