import { NextResponse } from "next/server";
import { prisma, getDatabaseUrlStatus } from "@/lib/prisma";

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

  return NextResponse.json({
    ok: db.ok,
    databaseUrl: urlStatus,
    db,
    envFlags: {
      hasConstructionStorage: !!process.env.construction_storage_PRISMA_DATABASE_URL,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasAdminEmail: !!process.env.ADMIN_EMAIL,
      hasAdminPassword: !!process.env.ADMIN_PASSWORD,
      hasJwt: !!process.env.JWT_SECRET,
    },
  });
}
