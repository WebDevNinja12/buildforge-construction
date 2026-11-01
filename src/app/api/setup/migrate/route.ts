import { NextRequest, NextResponse } from "next/server";
import { runFullDbMigrate } from "@/lib/db-migrate";
import { ensureAdminFromEnv, DEFAULT_ADMIN_EMAIL } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Creates/updates all tables and columns.
 * Open once after deploy: GET or POST /api/setup/migrate
 */
export async function POST(_req: NextRequest) {
  try {
    const migrate = await runFullDbMigrate();
    let adminEmail: string | null = null;
    try {
      await ensureAdminFromEnv();
      adminEmail = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase();
      const row = await prisma.$queryRaw<{ email: string }[]>`
        SELECT email FROM "User" WHERE lower(email) = lower(${adminEmail}) LIMIT 1
      `;
      adminEmail = row[0]?.email || adminEmail;
    } catch (e) {
      return NextResponse.json({
        migrate,
        adminError: e instanceof Error ? e.message : "admin failed",
      });
    }
    return NextResponse.json({
      ok: migrate.ok,
      migrate,
      adminEmail,
      note: "NIN is not part of login. Clients enter NIN only on installment document forms.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Migrate failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
