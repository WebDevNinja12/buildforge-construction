import { NextResponse } from "next/server";
import { prisma, getDatabaseUrlStatus } from "@/lib/prisma";
import { blobStatus } from "@/lib/media";

export const dynamic = "force-dynamic";

/** Add columns Prisma may expect but Neon is missing (schema drift). */
async function healSchema() {
  const statements = [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nin" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bvn" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nextOfKinJson" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "historyClearedAt" TIMESTAMP(3)`,
    `ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "previousFileUrl" TEXT`,
    `ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "previousRejectReason" TEXT`,
  ];
  const results: string[] = [];
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push("ok");
    } catch (e) {
      results.push(e instanceof Error ? e.message.slice(0, 80) : "fail");
    }
  }
  return results;
}

export async function GET() {
  const urlStatus = getDatabaseUrlStatus();
  let heal: string[] | null = null;
  let db: { ok: boolean; userCount?: number; error?: string } = { ok: false };

  try {
    // Always try to heal drift first so login/findUnique stops failing
    heal = await healSchema();
  } catch (e) {
    heal = [e instanceof Error ? e.message : "heal failed"];
  }

  try {
    const userCount = await prisma.user.count();
    db = { ok: true, userCount };
  } catch (e) {
    db = {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const blob = blobStatus();

  return NextResponse.json({
    ok: db.ok,
    databaseUrl: urlStatus,
    db,
    schemaHeal: heal,
    blob,
    envFlags: {
      hasConstructionStorage: !!process.env.construction_storage_PRISMA_DATABASE_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasAdminEmail: !!process.env.ADMIN_EMAIL,
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      hasJwt: !!process.env.JWT_SECRET,
      hasBlobToken: blob.connected,
      hasBlobStoreId: blob.storeLinked,
      constructionStoreId: process.env.construction_STORE_ID || null,
      constructionHouseStoreId: process.env.construction_house_STORE_ID || null,
    },
  });
}
