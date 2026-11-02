import { NextResponse } from "next/server";
import { runFullDbMigrate } from "@/lib/db-migrate";
import { ensureAdminFromEnv, DEFAULT_ADMIN_EMAIL } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Public one-shot DB heal + admin ensure.
 * GET /api/db-heal
 */
export async function GET() {
  const migrate = await runFullDbMigrate();
  let admin: string | null = null;
  let adminError: string | null = null;
  try {
    await ensureAdminFromEnv();
    const email = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase();
    const rows = await prisma.$queryRaw<{ email: string }[]>`
      SELECT email FROM "User" WHERE lower(email) = ${email} LIMIT 1
    `;
    admin = rows[0]?.email || email;
  } catch (e) {
    adminError = e instanceof Error ? e.message : "admin failed";
  }
  return NextResponse.json({
    ok: migrate.ok,
    buildId: "hama-2026-11-02-v5",
    migrate,
    admin,
    adminError,
    note: "NIN is installment-only. Login uses email/password only.",
  });
}

export async function POST() {
  return GET();
}
