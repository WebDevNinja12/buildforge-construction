import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminFromEnv, DEFAULT_ADMIN_EMAIL } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Applies missing columns/tables that prisma db push may have missed.
 * Safe to run repeatedly (IF NOT EXISTS).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SETUP_SECRET || process.env.CRON_SECRET;
  const header = req.headers.get("x-setup-secret") || "";
  const auth = req.headers.get("authorization") || "";
  const okSecret = secret && (header === secret || auth === `Bearer ${secret}`);
  // Allow open migrate when no secret is configured (bootstrap)
  if (secret && !okSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const steps: { sql: string; label: string }[] = [
    { label: "User.nin", sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nin" TEXT;` },
    { label: "User.bvn", sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bvn" TEXT;` },
    {
      label: "User.nextOfKinJson",
      sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nextOfKinJson" TEXT;`,
    },
    {
      label: "User.signatureUrl",
      sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT;`,
    },
    {
      label: "User.historyClearedAt",
      sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "historyClearedAt" TIMESTAMP(3);`,
    },
    {
      label: "InstallmentDocument.previousFileUrl",
      sql: `ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "previousFileUrl" TEXT;`,
    },
    {
      label: "InstallmentDocument.previousRejectReason",
      sql: `ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "previousRejectReason" TEXT;`,
    },
    {
      label: "Contract table",
      sql: `CREATE TABLE IF NOT EXISTS "Contract" (
        "id" TEXT PRIMARY KEY,
        "contractNumber" TEXT NOT NULL UNIQUE,
        "verifyToken" TEXT NOT NULL UNIQUE,
        "userId" TEXT NOT NULL,
        "reservationId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'ACTIVE',
        "pdfUrl" TEXT,
        "clientName" TEXT,
        "serviceTitle" TEXT,
        "paymentMethod" TEXT,
        "totalAmount" DOUBLE PRECISION,
        "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3),
        "metaJson" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
    },
    {
      label: "VerificationScan table",
      sql: `CREATE TABLE IF NOT EXISTS "VerificationScan" (
        "id" TEXT PRIMARY KEY,
        "contractId" TEXT NOT NULL,
        "scannedBy" TEXT,
        "ip" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`,
    },
  ];

  const results: Record<string, string> = {};
  for (const step of steps) {
    try {
      await prisma.$executeRawUnsafe(step.sql);
      results[step.label] = "ok";
    } catch (e) {
      results[step.label] = e instanceof Error ? e.message : "fail";
    }
  }

  let admin: { email: string } | null = null;
  try {
    await ensureAdminFromEnv();
    const a = await prisma.user.findUnique({
      where: { email: (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase() },
      select: { email: true },
    });
    admin = a;
    results.admin = a ? `ready:${a.email}` : "missing";
  } catch (e) {
    results.admin = e instanceof Error ? e.message : "admin fail";
  }

  const failed = Object.entries(results).filter(([, v]) => v !== "ok" && !String(v).startsWith("ready"));
  return NextResponse.json({
    ok: failed.length === 0,
    results,
    adminEmail: admin?.email || process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL,
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
