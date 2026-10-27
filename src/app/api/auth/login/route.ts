import { NextRequest, NextResponse } from "next/server";
import { loginUser, setSession, ensureAdminFromEnv } from "@/lib/auth";

/**
 * Unified login while new admin portal rolls out.
 * - Admins → /admin
 * - Clients → /dashboard or /pending-approval
 * Also refreshes admin password from env when possible.
 */
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

    // Refresh admin accounts from env before authenticating
    await ensureAdminFromEnv().catch(() => false);

    const user = await loginUser(email, password);
    await setSession(user);

    const redirect =
      user.role === "ADMIN"
        ? "/admin"
        : user.status === "PENDING_APPROVAL"
          ? "/pending-approval"
          : "/dashboard";

    return NextResponse.json({ user, redirect });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
