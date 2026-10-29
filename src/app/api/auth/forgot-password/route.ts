import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  appBaseUrl,
  generateResetToken,
  saveResetToken,
  sendResetEmail,
} from "@/lib/password-reset";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    // Always return the same message (do not reveal if email exists)
    const generic = {
      ok: true,
      message:
        "If an account exists for that email, password reset instructions have been sent. Check your inbox (and spam). The link expires in 1 hour.",
    };

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, role: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      return NextResponse.json(generic);
    }

    const token = generateResetToken();
    await saveResetToken(user.id, token);
    const resetUrl = `${appBaseUrl()}/reset-password?token=${token}`;

    const mail = await sendResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
    });

    // Notify user in-app (visible after they regain access / next login)
    await prisma.notification
      .create({
        data: {
          userId: user.id,
          title: "Password reset requested",
          body: "A password reset was requested for your account. If this was not you, contact support.",
          type: "SECURITY",
          link: "/login",
        },
      })
      .catch(() => null);

    // Admin audit (no raw token in log — only that a reset was issued)
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
      take: 5,
    });
    for (const a of admins) {
      await prisma.adminActivityLog
        .create({
          data: {
            adminId: a.id,
            action: "PASSWORD_RESET_REQUEST",
            entity: "User",
            entityId: user.id,
            details: JSON.stringify({
              email: user.email,
              role: user.role,
              emailSent: mail.sent,
              mode: mail.mode,
            }),
          },
        })
        .catch(() => null);
    }

    // When email is not configured, still allow reset via returned code for same session UX
    // Only expose resetUrl when email could not be sent AND SETUP allows it, or always hide it.
    // Security: never return resetUrl in production response.
    const response: Record<string, unknown> = { ...generic, emailSent: mail.sent };

    // Dev / emergency: if RESEND not set and SETUP_ALLOW_RESET, include link so owner can finish setup
    if (!mail.sent && process.env.SETUP_ALLOW_RESET === "true") {
      response.resetUrl = resetUrl;
      response.hint =
        "Email provider not configured (set RESEND_API_KEY). Temporary reset link included because SETUP_ALLOW_RESET=true.";
    }

    return NextResponse.json(response);
  } catch (e) {
    console.error("forgot-password", e);
    return NextResponse.json({ error: "Request failed" }, { status: 500 });
  }
}
