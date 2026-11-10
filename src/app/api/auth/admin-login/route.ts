import { NextRequest, NextResponse } from "next/server";
import { loginUser, setSession, ensureAdminFromEnv } from "@/lib/auth";
import { healSchema } from "@/lib/schema-heal";

async function healUserColumns() {
  await healSchema().catch(() => null);
}

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

    await healUserColumns();
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
    if (
      message.includes("column") ||
      message.includes("nin") ||
      message.includes("prisma") ||
      message.toLowerCase().includes("too many connections")
    ) {
      await healUserColumns();
      return NextResponse.json(
        {
          error:
            "Database was missing columns and is being fixed. Wait 10 seconds and try again.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
