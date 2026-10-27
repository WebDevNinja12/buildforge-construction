/** Format remaining time until a date as "3d 4h 20m" or "Expired" */
export function formatCountdown(expiresAt: Date | string | null | undefined): string {
  if (!expiresAt) return "—";
  const end = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const ms = end.getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function isExpiringSoon(expiresAt: Date | string | null | undefined, withinHours = 24): boolean {
  if (!expiresAt) return false;
  const end = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  const ms = end.getTime() - Date.now();
  return ms > 0 && ms <= withinHours * 3600 * 1000;
}
