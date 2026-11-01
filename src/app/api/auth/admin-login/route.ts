import { NextRequest, NextResponse } from "next/server";
import { loginUser, setSession, ensureAdminFromEnv } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // Auto-heal missing columns once if schema drifted
    try {
      await ensureAdminFromEnv();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("does not exist") || msg.includes("nin") || msg.includes("column")) {
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nin" TEXT;`);
          await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bvn" TEXT;`);
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nextOfKinJson" TEXT;`
          );
          await prisma.$executeRawUnsafe(
            `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT;`
          );
          await ensureAdminFromEnv();
        } catch (e2) {
          console.error("admin-login schema heal failed", e2);
        }
      } else {
        console.error("ensureAdminFromEnv", e);
      }
    }

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
    // Surface schema errors more clearly for ops
    if (message.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "Database schema is out of date. Open /api/setup/migrate once, then try again.",
          detail: message.slice(0, 200),
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
