/**
 * Super-Admin gate for destructive actions (contract terminate, force reopen, etc.)
 * SUPER_ADMIN_EMAILS=comma-separated list, or falls back to ADMIN_EMAIL / DEFAULT.
 */
import { DEFAULT_ADMIN_EMAIL } from "@/lib/auth";

export function superAdminEmails(): string[] {
  const raw =
    process.env.SUPER_ADMIN_EMAILS ||
    process.env.ADMIN_EMAIL ||
    DEFAULT_ADMIN_EMAIL;
  return String(raw)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const list = superAdminEmails();
  return list.includes(String(email).trim().toLowerCase());
}

export async function assertSuperAdmin(session: {
  role: string;
  email?: string | null;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (session.role !== "ADMIN") {
    return { ok: false, error: "Admin only" };
  }
  if (!process.env.SUPER_ADMIN_EMAILS) {
    return { ok: true };
  }
  if (!isSuperAdminEmail(session.email)) {
    return {
      ok: false,
      error: "Super-Admin only. Ask a Super-Admin to perform this action.",
    };
  }
  return { ok: true };
}
