import { prisma } from "@/lib/prisma";

/**
 * Idempotent SQL to align Neon with the app.
 * User has NO nin/bvn — those belong only on InstallmentDocument (textValue / file).
 */
const STATEMENTS: string[] = [
  // Core User (no nin/bvn)
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "clientType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationNote" TEXT,
    "avatarUrl" TEXT,
    "signatureUrl" TEXT,
    "historyClearedAt" TIMESTAMP(3),
    "agreedTermsAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "archiveReason" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  // If an old Prisma client still SELECTs nin, add nullable columns so login never crashes
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nin" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bvn" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nextOfKinJson" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "historyClearedAt" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationNote" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clientType" TEXT DEFAULT 'INDIVIDUAL'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "archiveReason" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agreedTermsAt" TIMESTAMP(3)`,

  `CREATE TABLE IF NOT EXISTS "UserDocument" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "CategoryDefault" (
    "id" TEXT PRIMARY KEY,
    "category" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "defaultExpiryHours" INTEGER NOT NULL,
    "installmentPlanMonths" INTEGER,
    "cancelDeductionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cancelPercentBeforeFirst" DOUBLE PRECISION,
    "cancelPercentAfterHalf" DOUBLE PRECISION,
    "graceHours" INTEGER NOT NULL DEFAULT 24,
    "continuesAfterHold" BOOLEAN NOT NULL DEFAULT false,
    "installmentRulesText" TEXT,
    "allowedFrequencies" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "Asset" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "location" TEXT,
    "image" TEXT,
    "images" TEXT,
    "mainImageIndex" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reservationHours" INTEGER,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "area" DOUBLE PRECISION,
    "features" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "images" TEXT`,
  `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "mainImageIndex" INTEGER DEFAULT 0`,
  `ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "reservationHours" INTEGER`,

  `CREATE TABLE IF NOT EXISTS "Reservation" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentType" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "installmentTotal" DOUBLE PRECISION,
    "installmentPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "installmentCount" INTEGER,
    "installmentFrequency" TEXT,
    "nextDueAt" TIMESTAMP(3),
    "planDeadlineAt" TIMESTAMP(3),
    "scheduleJson" TEXT,
    "docsStatus" TEXT NOT NULL DEFAULT 'INCOMPLETE',
    "rulesAgreedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "docsStatus" TEXT DEFAULT 'INCOMPLETE'`,
  `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "scheduleJson" TEXT`,
  `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "installmentFrequency" TEXT`,
  `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "planDeadlineAt" TIMESTAMP(3)`,
  `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "nextDueAt" TIMESTAMP(3)`,
  `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "installmentPaid" DOUBLE PRECISION DEFAULT 0`,
  `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "installmentTotal" DOUBLE PRECISION`,
  `ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "rulesAgreedAt" TIMESTAMP(3)`,

  `CREATE TABLE IF NOT EXISTS "Tool" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dailyRate" DOUBLE PRECISION NOT NULL,
    "weeklyRate" DOUBLE PRECISION NOT NULL,
    "available" INTEGER NOT NULL DEFAULT 1,
    "image" TEXT,
    "images" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "ToolRental" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "total" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "Worker" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "dailyRate" DOUBLE PRECISION NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "bio" TEXT,
    "image" TEXT,
    "location" TEXT,
    "skills" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "HireRequest" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "location" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "total" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "WorkerReview" (
    "id" TEXT PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "userId" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "comment" TEXT,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "budget" DOUBLE PRECISION,
    "location" TEXT,
    "clientId" TEXT,
    "managerId" TEXT,
    "contactNote" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // Installment documents — NIN/BVN live here as type + textValue + optional file
  `CREATE TABLE IF NOT EXISTS "InstallmentDocument" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reservationId" TEXT,
    "type" TEXT NOT NULL,
    "label" TEXT,
    "fileUrl" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT,
    "textValue" TEXT,
    "metaJson" TEXT,
    "inputType" TEXT NOT NULL DEFAULT 'FILE',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "previousFileUrl" TEXT,
    "previousRejectReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "textValue" TEXT`,
  `ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "metaJson" TEXT`,
  `ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "inputType" TEXT DEFAULT 'FILE'`,
  `ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "previousFileUrl" TEXT`,
  `ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "previousRejectReason" TEXT`,
  `ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "reservationId" TEXT`,

  `CREATE TABLE IF NOT EXISTS "RequiredDocumentType" (
    "id" TEXT PRIMARY KEY,
    "category" TEXT NOT NULL DEFAULT 'ALL',
    "clientType" TEXT NOT NULL DEFAULT 'BOTH',
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "instruction" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "inputType" TEXT NOT NULL DEFAULT 'FILE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "type" TEXT NOT NULL,
    "referenceId" TEXT,
    "stripeId" TEXT,
    "proofUrl" TEXT,
    "rejectReason" TEXT,
    "installmentId" TEXT,
    "reservationId" TEXT,
    "toolRentalId" TEXT,
    "hireRequestId" TEXT,
    "projectId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "AdminActivityLog" (
    "id" TEXT PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "FinishedProject" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "image" TEXT,
    "images" TEXT,
    "completedAt" TIMESTAMP(3),
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "SiteSetting" (
    "id" TEXT PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "QuoteRequest" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "service" TEXT,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "Testimonial" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "quote" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS "Contract" (
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
  )`,

  `CREATE TABLE IF NOT EXISTS "VerificationScan" (
    "id" TEXT PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "scannedBy" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
];

export async function runFullDbMigrate(): Promise<{
  ok: boolean;
  applied: number;
  failed: { index: number; error: string }[];
}> {
  const failed: { index: number; error: string }[] = [];
  let applied = 0;
  for (let i = 0; i < STATEMENTS.length; i++) {
    try {
      await prisma.$executeRawUnsafe(STATEMENTS[i]);
      applied++;
    } catch (e) {
      failed.push({
        index: i,
        error: e instanceof Error ? e.message.slice(0, 120) : "fail",
      });
    }
  }
  return { ok: failed.length === 0, applied, failed };
}
