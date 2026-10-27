import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminFromEnv, hashPassword } from "@/lib/auth";
import { ensureCategoryDefaults } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/**
 * Ensures core rows exist (admin + category defaults).
 * Tables themselves are created by `prisma db push` at build time.
 *
 * Auth: x-setup-secret must match SETUP_SECRET, OR body.secret.
 */
export async function POST(req: NextRequest) {
  try {
    const setupSecret = process.env.SETUP_SECRET;
    const provided =
      req.headers.get("x-setup-secret") ||
      new URL(req.url).searchParams.get("secret");

    // Allow once if SETUP_SECRET matches, or if no SETUP_SECRET use JWT_SECRET
    const expected = setupSecret || process.env.JWT_SECRET;
    if (!expected || provided !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Touch DB — will throw if tables missing
    let tableError: string | null = null;
    try {
      await prisma.user.count();
    } catch (e) {
      tableError = e instanceof Error ? e.message : String(e);
    }

    if (tableError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Database tables missing or connection failed",
          detail: tableError,
          fix: "Redeploy so build runs prisma db push with a valid DATABASE_URL (Neon construction_storage_PRISMA_DATABASE_URL).",
        },
        { status: 500 }
      );
    }

    await ensureCategoryDefaults().catch((e) =>
      console.error("category defaults", e)
    );
    await ensureAdminFromEnv().catch((e) => console.error("admin env", e));

    // Guarantee legacy admin works
    const legacyPass =
      process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length >= 8
        ? process.env.ADMIN_PASSWORD
        : "admin123";
    const hash = await hashPassword(legacyPass);
    await prisma.user.upsert({
      where: { email: "admin@buildforge.com" },
      update: {
        password: hash,
        role: "ADMIN",
        status: "APPROVED",
        verificationStatus: "VERIFIED",
        approvedAt: new Date(),
        verifiedAt: new Date(),
      },
      create: {
        email: "admin@buildforge.com",
        password: hash,
        name: "Admin User",
        role: "ADMIN",
        status: "APPROVED",
        verificationStatus: "VERIFIED",
        approvedAt: new Date(),
        verifiedAt: new Date(),
        agreedTermsAt: new Date(),
      },
    });

    if (process.env.ADMIN_EMAIL) {
      const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
      const pass = process.env.ADMIN_PASSWORD || legacyPass;
      const h = await hashPassword(pass);
      await prisma.user.upsert({
        where: { email },
        update: {
          password: h,
          role: "ADMIN",
          status: "APPROVED",
          verificationStatus: "VERIFIED",
          approvedAt: new Date(),
          verifiedAt: new Date(),
        },
        create: {
          email,
          password: h,
          name: process.env.ADMIN_NAME || "Administrator",
          role: "ADMIN",
          status: "APPROVED",
          verificationStatus: "VERIFIED",
          approvedAt: new Date(),
          verifiedAt: new Date(),
          agreedTermsAt: new Date(),
        },
      });
    }

    const users = await prisma.user.count();
    const categories = await prisma.categoryDefault.count();

    return NextResponse.json({
      ok: true,
      message: "Database reachable; admin and category defaults ready",
      users,
      categories,
      login: {
        email: "admin@buildforge.com",
        passwordNote:
          "Password is ADMIN_PASSWORD from Vercel, or admin123 if ADMIN_PASSWORD was not set when this ran",
        adminLoginUrl: "/admin/login",
        clientLoginUrl: "/login",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Setup failed",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    usage: "POST with header x-setup-secret: SETUP_SECRET",
  });
}
