import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_HOURS = 1;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateResetToken() {
  return randomBytes(32).toString("hex");
}

export function resetKey(tokenHash: string) {
  return `pwd_reset_${tokenHash}`;
}

export async function saveResetToken(userId: string, token: string) {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_HOURS * 60 * 60 * 1000).toISOString();
  await prisma.siteSetting.upsert({
    where: { key: resetKey(tokenHash) },
    create: {
      key: resetKey(tokenHash),
      value: JSON.stringify({ userId, expiresAt }),
    },
    update: {
      value: JSON.stringify({ userId, expiresAt }),
    },
  });
  return { tokenHash, expiresAt };
}

export async function consumeResetToken(token: string): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(token);
  const row = await prisma.siteSetting.findUnique({ where: { key: resetKey(tokenHash) } });
  if (!row) return null;
  try {
    const data = JSON.parse(row.value) as { userId: string; expiresAt: string };
    if (!data.userId || !data.expiresAt) return null;
    if (new Date(data.expiresAt).getTime() < Date.now()) {
      await prisma.siteSetting.delete({ where: { key: resetKey(tokenHash) } }).catch(() => null);
      return null;
    }
    // one-time use
    await prisma.siteSetting.delete({ where: { key: resetKey(tokenHash) } }).catch(() => null);
    return { userId: data.userId };
  } catch {
    return null;
  }
}

export function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` ||
    "https://buildforge-construction.vercel.app"
  ).replace(/\/$/, "");
}

/** Optional email via Resend if RESEND_API_KEY is set */
export async function sendResetEmail(opts: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<{ sent: boolean; mode: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Hama Construction <onboarding@resend.dev>";

  if (key) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: opts.to,
          subject: "Reset your Hama Construction password",
          html: `
            <p>Hello ${opts.name},</p>
            <p>We received a request to reset your password.</p>
            <p><a href="${opts.resetUrl}">Click here to set a new password</a></p>
            <p>This link expires in ${TOKEN_HOURS} hour(s). If you did not request this, ignore this email.</p>
            <p>— Hama Construction</p>
          `,
        }),
      });
      if (res.ok) return { sent: true, mode: "resend" };
      console.error("Resend error", await res.text());
    } catch (e) {
      console.error("Resend failed", e);
    }
  }

  // Fallback: no email provider — link is still valid; logged for support
  console.info("[password-reset]", opts.to, opts.resetUrl);
  return { sent: false, mode: "log" };
}
