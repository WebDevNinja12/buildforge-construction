import { NextRequest, NextResponse } from "next/server";
import { loginUser, setSession } from "@/lib/auth";

/** Client / customer login only — admins must use /api/auth/admin-login */
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

    const user = await loginUser(email, password, { requireRole: "CLIENT" });
    await setSession(user);

    return NextResponse.json({
      user,
      redirect: user.status === "PENDING_APPROVAL" ? "/pending-approval" : "/dashboard",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
