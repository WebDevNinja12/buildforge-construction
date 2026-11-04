import { prisma } from "@/lib/prisma";

/** Add missing columns so Prisma findUnique/create stop failing on drifted DBs */
export async function healSchema(): Promise<string[]> {
  const results: string[] = [];
  const stmts = [
    // User
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nin" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bvn" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nextOfKinJson" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "historyClearedAt" TIMESTAMP(3)`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3)`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3)`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agreedTermsAt" TIMESTAMP(3)`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationNote" TEXT`,
    // Asset — root cause of reservation failure
    `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "image" TEXT`,
    `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "images" TEXT`,
    `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "mainImageIndex" INTEGER DEFAULT 0`,
    `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT true`,
    `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "reservationHours" INTEGER`,
    `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "bedrooms" INTEGER`,
    `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "bathrooms" INTEGER`,
    `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "area" DOUBLE PRECISION`,
    `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "features" TEXT`,
    `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "location" TEXT`,
    // Reservation
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "paymentType" TEXT`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3)`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "installmentTotal" DOUBLE PRECISION`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "installmentPaid" DOUBLE PRECISION DEFAULT 0`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "installmentCount" INTEGER`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "installmentFrequency" TEXT`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "nextDueAt" TIMESTAMP(3)`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "planDeadlineAt" TIMESTAMP(3)`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "scheduleJson" TEXT`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "docsStatus" TEXT DEFAULT 'INCOMPLETE'`,
    `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "rulesAgreedAt" TIMESTAMP(3)`,
    // Payment
    `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "proofUrl" TEXT`,
    `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT`,
    `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reservationId" TEXT`,
    `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT`,
    `ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3)`,
  ];

  for (const sql of stmts) {
    try {
      await prisma.$executeRawUnsafe(sql);
      results.push("ok");
    } catch (e) {
      results.push(e instanceof Error ? e.message.slice(0, 80) : "fail");
    }
  }
  return results;
}
