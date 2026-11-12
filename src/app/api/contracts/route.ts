import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { healSchema } from "@/lib/schema-heal";

export const dynamic = "force-dynamic";

async function ensureContractTable() {
  const stmts = [
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
      "issuedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3),
      "metaJson" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT`,
    `ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "clientName" TEXT`,
    `ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "serviceTitle" TEXT`,
    `ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT`,
    `ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "totalAmount" DOUBLE PRECISION`,
    `ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "issuedAt" TIMESTAMP(3)`,
    `ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`,
    `ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "metaJson" TEXT`,
    `ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS "reservationId" TEXT`,
  ];
  for (const sql of stmts) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* */
    }
  }
}

export async function GET() {
  try {
    await healSchema().catch(() => null);
    await ensureContractTable();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const where = session.role === "ADMIN" ? {} : { userId: session.id };

    let contracts: any[] = [];
    try {
      contracts = await prisma.contract.findMany({
        where,
        orderBy: { issuedAt: "desc" },
      });
    } catch {
      try {
        contracts = await prisma.contract.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });
      } catch (e) {
        console.error(e);
        return NextResponse.json({ contracts: [], error: "Could not load contracts" });
      }
    }

    return NextResponse.json({ contracts });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load contracts", contracts: [] }, { status: 500 });
  }
}
