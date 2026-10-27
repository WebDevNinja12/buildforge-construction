import { NextRequest, NextResponse } from "next/server";
import { loginUser, setSession, ensureAdminFromEnv } from "@/lib/auth";

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

    await ensureAdminFromEnv().catch(() => false);

    const user = await loginUser(email, password, { requireRole: "ADMIN" });
    await setSession(user);

    return NextResponse.json({ user, redirect: "/admin" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    const hasEnv = !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
    return NextResponse.json(
      {
        error: message,
        hint: hasEnv
          ? "Try admin@buildforge.com with your ADMIN_PASSWORD, or the password shown in the panel instructions."
          : "Server missing ADMIN_PASSWORD. Use admin@buildforge.com / admin123 on current production until redeploy succeeds.",
      },
      { status: 401 }
    );
  }
}
