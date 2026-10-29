import { NextResponse } from "next/server";
import { prisma, getDatabaseUrlStatus } from "@/lib/prisma";
import { blobStatus } from "@/lib/media";

export const dynamic = "force-dynamic";

export async function GET() {
  const urlStatus = getDatabaseUrlStatus();
  let db: { ok: boolean; userCount?: number; error?: string } = { ok: false };

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
