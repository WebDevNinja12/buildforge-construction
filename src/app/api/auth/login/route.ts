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

    const user = await loginUser(email, password);
    await setSession({ id: user.id, role: user.role });

    const redirect =
      user.role === "ADMIN"
        ? "/admin"
        : user.status === "PENDING_APPROVAL"
          ? "/pending-approval"
          : "/dashboard";

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
    const message = error instanceof Error ? error.message : "Login failed";
    if (
      message.includes("prisma") ||
      message.includes("column") ||
      message.includes("does not exist")
    ) {
      return NextResponse.json(
        { error: "Database is updating. Please wait a minute and try again." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
