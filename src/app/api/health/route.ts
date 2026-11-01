import { NextResponse } from "next/server";
import { prisma, getDatabaseUrlStatus } from "@/lib/prisma";
import { blobStatus } from "@/lib/media";
import { runFullDbMigrate } from "@/lib/db-migrate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const BUILD_ID = "hama-2026-11-01-v4-migrate";

export async function GET() {
  const urlStatus = getDatabaseUrlStatus();
  let migrate: Awaited<ReturnType<typeof runFullDbMigrate>> | { error: string } | null =
    null;
  let db: { ok: boolean; userCount?: number; error?: string } = { ok: false };

  try {
    migrate = await runFullDbMigrate();
  } catch (e) {
    migrate = { error: e instanceof Error ? e.message : "migrate failed" };
  }

  try {
    const rows = await prisma.$queryRaw<{ c: bigint }[]>`SELECT COUNT(*)::bigint AS c FROM "User"`;
    db = { ok: true, userCount: Number(rows[0]?.c ?? 0) };
  } catch (e) {
    try {
      const userCount = await prisma.user.count();
      db = { ok: true, userCount };
    } catch (e2) {
      db = {
        ok: false,
        error: e2 instanceof Error ? e2.message : String(e2),
      };
    }
  }

  const blob = blobStatus();

  return NextResponse.json({
    ok: db.ok,
    buildId: BUILD_ID,
    databaseUrl: urlStatus,
    db,
    migrate,
    blob,
    note: "NIN is installment-document only. Login does not use NIN.",
  });
}
