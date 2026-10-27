import { NextRequest, NextResponse } from "next/server";
import { loginUser, setSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ensureCategoryDefaults } from "@/lib/maintenance";

/** Ensure production admin from env exists (idempotent). */
async function ensureAdminFromEnv() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";
  if (!email || !password || password.length < 8) return;

  try {
    await ensureCategoryDefaults().catch(() => null);
    const hash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      update: {
        // Keep password in sync with env until you change it in-app later
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
  } catch (e) {
    console.error("ensureAdminFromEnv", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // First login attempt bootstraps admin from Vercel env if configured
    await ensureAdminFromEnv();

    const user = await loginUser(email, password);
    await setSession(user);

    return NextResponse.json({ user });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
