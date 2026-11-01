import { NextResponse } from "next/server";
import { prisma, getDatabaseUrlStatus } from "@/lib/prisma";
import { blobStatus } from "@/lib/media";
import { runFullDbMigrate } from "@/lib/db-migrate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const urlStatus = getDatabaseUrlStatus();
  let migrate: Awaited<ReturnType<typeof runFullDbMigrate>> | null = null;
  let db: { ok: boolean; userCount?: number; error?: string } = { ok: false };

  try {
    migrate = await runFullDbMigrate();
  } catch (e) {
    migrate = {
      ok: false,
      applied: 0,
      failed: [{ index: -1, error: e instanceof Error ? e.message : "migrate failed" }],
    };
  }

  try {
    const rows = await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*)::bigint AS c FROM "User"`;
    db = { ok: true, userCount: Number(rows[0]?.c ?? 0) };
  } catch (e) {
    db = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const blob = blobStatus();

  return NextResponse.json({
    ok: db.ok,
    databaseUrl: urlStatus,
    db,
    migrate,
    blob,
    note: "NIN is installment-document only; login does not use NIN.",
    envFlags: {
      hasConstructionStorage: !!process.env.construction_storage_PRISMA_DATABASE_URL,
      hasAdminEmail: !!process.env.ADMIN_EMAIL,
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      hasJwt: !!process.env.JWT_SECRET,
      hasBlobToken: blob.connected,
    },
  });
}
