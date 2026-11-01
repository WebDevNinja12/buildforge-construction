import { NextRequest, NextResponse } from "next/server";
import { loginUser, setSession, ensureAdminFromEnv } from "@/lib/auth";
import { runFullDbMigrate } from "@/lib/db-migrate";

export const maxDuration = 60;

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

    // Ensure all tables/columns exist before any auth query
    await runFullDbMigrate().catch((e) => console.error("migrate on login", e));

    try {
      await ensureAdminFromEnv();
    } catch (e) {
      console.error("ensureAdminFromEnv", e);
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
    // Never show raw Prisma column errors on the form
    if (
      message.includes("prisma") ||
      message.includes("column") ||
      message.includes("does not exist") ||
      message.includes("nin")
    ) {
      await runFullDbMigrate().catch(() => null);
      return NextResponse.json(
        {
          error:
            "Database tables were updated. Please wait 15 seconds and sign in again.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
