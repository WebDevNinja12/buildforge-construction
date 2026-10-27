import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ensureCategoryDefaults } from "@/lib/maintenance";

/**
 * One-time production admin bootstrap.
 *
 * Headers or body:
 *   x-setup-secret: must match SETUP_SECRET env
 * Body JSON: { email, password, name? }
 *
 * Only works when zero ADMIN users exist (or SETUP_ALLOW_RESET=true).
 */
export async function POST(req: NextRequest) {
  try {
    const setupSecret = process.env.SETUP_SECRET;
    if (!setupSecret) {
      return NextResponse.json(
        { error: "SETUP_SECRET is not configured on the server" },
        { status: 503 }
      );
    }

    const provided =
      req.headers.get("x-setup-secret") ||
      new URL(req.url).searchParams.get("secret");
    if (provided !== setupSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "Administrator").trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    const allowReset = process.env.SETUP_ALLOW_RESET === "true";
    if (adminCount > 0 && !allowReset) {
      return NextResponse.json(
        { error: "An admin already exists. Use login or set SETUP_ALLOW_RESET=true temporarily." },
        { status: 409 }
      );
    }

    await ensureCategoryDefaults().catch(() => null);

    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: hash,
        name,
        role: "ADMIN",
        status: "APPROVED",
        verificationStatus: "VERIFIED",
        approvedAt: new Date(),
        verifiedAt: new Date(),
      },
      create: {
        email,
        password: hash,
        name,
        role: "ADMIN",
        status: "APPROVED",
        verificationStatus: "VERIFIED",
        approvedAt: new Date(),
        verifiedAt: new Date(),
        agreedTermsAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Admin account ready. Sign in at /login — password is not returned.",
      email: user.email,
      name: user.name,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Setup failed" },
      { status: 500 }
    );
  }
}
