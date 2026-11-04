import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateResetToken, saveResetToken } from "@/lib/password-reset";
import { sendEmail } from "@/lib/email";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://buildforge-construction.vercel.app"
  ).replace(/\/$/, "");
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const body = await req.json();
    const action = String(body.action || "").trim();

    if (action === "change_own") {
      const currentPassword = String(body.currentPassword || "");
      const newPassword = String(body.newPassword || "");
      const confirmPassword = String(body.confirmPassword || "");

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters" },
          { status: 400 }
        );
      }
      if (newPassword !== confirmPassword) {
        return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
      }

      const user = await prisma.user.findUnique({
        where: { id: admin.id },
        select: { id: true, password: true, email: true },
      });
      if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "PASSWORD_CHANGE_OWN",
        entity: "User",
        entityId: admin.id,
        details: { email: user.email },
      });

      return NextResponse.json({ ok: true, message: "Your password was updated." });
    }

    if (action === "set_user") {
      const email = String(body.email || "").trim().toLowerCase();
      const newPassword = String(body.newPassword || "");
      if (!email || newPassword.length < 8) {
        return NextResponse.json(
          { error: "Email and a new password (min 8 characters) are required" },
          { status: 400 }
        );
      }

      const target = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, role: true, deletedAt: true },
      });
      if (!target || target.deletedAt) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: target.id }, data: { password: hashed } });

      await prisma.notification
        .create({
          data: {
            userId: target.id,
            title: "Password updated by admin",
            body: "An administrator set a new password on your account.",
            type: "SECURITY",
          },
        })
        .catch(() => null);

      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "PASSWORD_SET_USER",
        entity: "User",
        entityId: target.id,
        details: { email: target.email, role: target.role },
        alsoNotifyEmails: [target.email],
      });

      return NextResponse.json({
        ok: true,
        message: `Password updated for ${target.email}. Share the new password securely with the user.`,
      });
    }

    if (action === "send_reset") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

      const target = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, deletedAt: true },
      });
      if (!target || target.deletedAt) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const token = generateResetToken();
      await saveResetToken(target.id, token);
      const resetUrl = `${appBaseUrl()}/reset-password?token=${token}`;

      const mail = await sendEmail({
        to: target.email,
        subject: "Reset your Hama Construction password",
        html: `<p>Hi ${target.name || "there"},</p>
<p>An administrator started a password reset for your account.</p>
<p><a href="${resetUrl}">Set a new password</a></p>
<p>This link expires in 1 hour.</p>
<p>— Hama Construction</p>`,
        text: `Reset: ${resetUrl}`,
      });

      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "PASSWORD_SEND_RESET",
        entity: "User",
        entityId: target.id,
        details: { email: target.email, emailSent: !!mail.ok },
        alsoNotifyEmails: [target.email],
      });

      return NextResponse.json({
        ok: true,
        message: mail.ok
          ? `Reset email sent to ${target.email}.`
          : `Reset link created (email not configured). Copy and share securely.`,
        resetUrl: mail.ok ? undefined : resetUrl,
        emailSent: !!mail.ok,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("admin password", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 }
    );
  }
}
