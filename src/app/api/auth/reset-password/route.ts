import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { consumeResetToken } from "@/lib/password-reset";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    const confirm = String(body.confirmPassword || body.confirm || "");

    if (!token) {
      return NextResponse.json({ error: "Reset token required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (confirm && password !== confirm) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    const consumed = await consumeResetToken(token);
    if (!consumed) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Request a new one." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: consumed.userId } });
    if (!user || user.deletedAt) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed },
    });

    await prisma.notification
      .create({
        data: {
          userId: user.id,
          title: "Password updated",
          body: "Your password was changed successfully. If you did not do this, contact support immediately.",
          type: "SECURITY",
          link: "/login",
        },
      })
      .catch(() => null);

    await prisma.adminActivityLog
      .create({
        data: {
          adminId: user.id,
          action: "PASSWORD_RESET_COMPLETE",
          entity: "User",
          entityId: user.id,
          details: user.email,
        },
      })
      .catch(() => null);

    const loginPath = user.role === "ADMIN" ? "/admin/login" : "/login";

    return NextResponse.json({
      ok: true,
      message: "Password updated. You can sign in now.",
      loginPath,
    });
  } catch (e) {
    console.error("reset-password", e);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
