import { NextRequest, NextResponse } from "next/server";
import { loginUser, setSession, ensureAdminFromEnv } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function healUserColumns() {
  for (const sql of [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nin" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bvn" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nextOfKinJson" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "historyClearedAt" TIMESTAMP(3)`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* ignore */
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    await healUserColumns();
    await ensureAdminFromEnv().catch(() => false);

    const user = await loginUser(email, password, { requireRole: "ADMIN" });
    await setSession({ id: user.id, role: user.role });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
      redirect: "/admin",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    if (message.includes("column") || message.includes("nin") || message.includes("prisma")) {
      await healUserColumns();
      return NextResponse.json(
        {
          error:
            "Database was missing columns and is being fixed. Wait 10 seconds and try again.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
