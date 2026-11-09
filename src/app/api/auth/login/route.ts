import { NextRequest, NextResponse } from "next/server";
import {
  loginUser,
  setSession,
  ensureAdminFromEnv,
  AccountBlockedError,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertClientLoginAllowed } from "@/lib/site-mode";
import { healSchema } from "@/lib/schema-heal";

const PLATFORM_RULES = [
  "Provide accurate personal or company information and valid supporting documents.",
  "Reservations are time-limited; pay before the hold expires or the listing is released.",
  "Installment plans follow the rules published per category; late payments may incur deductions.",
  "Do not misuse the platform, submit fraudulent documents, or share your account.",
  "Only the account holder (or authorized company contact) may manage bookings and payments.",
  "Hama Construction may suspend accounts that violate these rules pending review.",
];

async function healUserColumns() {
  await healSchema().catch(() => null);
  for (const sql of [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nin" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bvn" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nextOfKinJson" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "historyClearedAt" TIMESTAMP(3)`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationNote" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clientType" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT`,
    `ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* ignore */
    }
  }
}

function isSchemaDriftError(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("unknown column") ||
    m.includes("column `") ||
    m.includes("no such column") ||
    (m.includes("prisma") && m.includes("column"))
  );
}

/** Client portal login only — admins must use /api/auth/admin-login */
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

    const access = await assertClientLoginAllowed();
    if (!access.ok) {
      return NextResponse.json(
        {
          error: access.message,
          code: "MAINTENANCE",
          maintenance: true,
        },
        { status: 503 }
      );
    }

    await ensureAdminFromEnv().catch(() => false);

    try {
      const user = await loginUser(email, password, { requireRole: "CLIENT" });
      await setSession({ id: user.id, role: user.role });

      const redirect =
        user.status === "PENDING_APPROVAL" ? "/pending-approval" : "/dashboard";

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
        },
        redirect,
      });
    } catch (error) {
      if (error instanceof AccountBlockedError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            status: error.status,
            verificationNote: error.verificationNote || null,
            rules: PLATFORM_RULES,
            message:
              error.code === "ACCOUNT_SUSPENDED"
                ? "Your account has been suspended because you violated one or more platform rules."
                : error.message,
          },
          { status: 403 }
        );
      }
      const message = error instanceof Error ? error.message : "Login failed";
      if (message.includes("Administrators must sign in")) {
        return NextResponse.json(
          {
            error: "Administrators must sign in at the staff login page.",
            code: "USE_ADMIN_PORTAL",
            adminLogin: "/admin/login",
          },
          { status: 403 }
        );
      }
      if (message.toLowerCase().includes("suspended")) {
        return NextResponse.json(
          {
            error: message,
            code: "ACCOUNT_SUSPENDED",
            status: "SUSPENDED",
            rules: PLATFORM_RULES,
            message:
              "Your account has been suspended because you violated one or more platform rules.",
          },
          { status: 403 }
        );
      }
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    if (isSchemaDriftError(message)) {
      await healUserColumns();
      return NextResponse.json(
        {
          error:
            "Database was missing columns and is being fixed. Wait 10 seconds and try again.",
          code: "SCHEMA_HEALING",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
