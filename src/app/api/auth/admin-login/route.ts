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
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
