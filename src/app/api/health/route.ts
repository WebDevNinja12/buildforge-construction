import { NextResponse } from "next/server";
import { prisma, getDatabaseUrlStatus } from "@/lib/prisma";
import { blobStatus } from "@/lib/media";

export const dynamic = "force-dynamic";

export async function GET() {
  const urlStatus = getDatabaseUrlStatus();
  let db: { ok: boolean; userCount?: number; error?: string } = { ok: false };
  let heal: string[] = [];

  // Heal missing columns that break login (NIN is installment-only; column may be null)
  for (const sql of [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nin" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bvn" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nextOfKinJson" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "historyClearedAt" TIMESTAMP(3)`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql);
      heal.push("ok");
    } catch (e) {
      heal.push(e instanceof Error ? e.message.slice(0, 60) : "fail");
    }
  }

  try {
    const userCount = await prisma.user.count();
    db = { ok: true, userCount };
  } catch (e) {
    db = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const blob = blobStatus();

  return NextResponse.json({
    ok: db.ok,
    buildId: "hama-2026-11-02-v6-stable",
    databaseUrl: urlStatus,
    db,
    schemaHeal: heal,
    blob,
    note: "NIN is for installment documents only; login uses email/password.",
  });
}
