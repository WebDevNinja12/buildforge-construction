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
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clientType" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyRc" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyTin" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyProfileJson" TEXT`,
    // Asset
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
    // HireRequest
    `ALTER TABLE "HireRequest" ADD COLUMN IF NOT EXISTS "total" DOUBLE PRECISION`,
    `ALTER TABLE "HireRequest" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
    `ALTER TABLE "HireRequest" ADD COLUMN IF NOT EXISTS "location" TEXT`,
    `ALTER TABLE "HireRequest" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`,
    `ALTER TABLE "HireRequest" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3)`,
    `ALTER TABLE "HireRequest" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3)`,
    // ToolRental
    `ALTER TABLE "ToolRental" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`,
    `ALTER TABLE "ToolRental" ADD COLUMN IF NOT EXISTS "total" DOUBLE PRECISION`,
    `ALTER TABLE "ToolRental" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3)`,
    `ALTER TABLE "ToolRental" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3)`,
    // SiteSetting — registration cooldown / platform keys
    `CREATE TABLE IF NOT EXISTS "SiteSetting" (
      "id" TEXT PRIMARY KEY,
      "key" TEXT NOT NULL UNIQUE,
      "value" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "value" TEXT`,
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
