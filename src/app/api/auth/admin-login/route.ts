import { NextRequest, NextResponse } from "next/server";
import { loginUser, setSession, ensureAdminFromEnv } from "@/lib/auth";

/** Admin-only login. Bootstraps admin from ADMIN_EMAIL / ADMIN_PASSWORD if set. */
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

    // Ensure env admin account exists / password matches env
    const bootstrapped = await ensureAdminFromEnv();
    if (!bootstrapped) {
      console.warn("Admin bootstrap skipped — check ADMIN_EMAIL and ADMIN_PASSWORD on Vercel");
    }

    const user = await loginUser(email, password, { requireRole: "ADMIN" });
    await setSession(user);

    return NextResponse.json({
      user,
      redirect: "/admin",
      bootstrapped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    // Help diagnose without leaking secrets
    const hasEnv =
      !!(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
    return NextResponse.json(
      {
        error: message,
        hint: hasEnv
          ? "Use the exact ADMIN_EMAIL and ADMIN_PASSWORD from Vercel env."
          : "ADMIN_EMAIL / ADMIN_PASSWORD are not set on the server.",
      },
      { status: 401 }
    );
  }
}
