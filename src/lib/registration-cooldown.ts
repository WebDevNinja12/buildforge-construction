import { prisma } from "@/lib/prisma";

const COOLDOWN_MS = 72 * 60 * 60 * 1000; // 72 hours

function emailKey(email: string) {
  return `reg_cooldown_email_${email.trim().toLowerCase()}`;
}

function phoneKey(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `reg_cooldown_phone_${digits}`;
}

/** After admin deletes a client, block same email/phone for 72 hours. */
export async function placeRegistrationCooldown(opts: {
  email: string;
  phone?: string | null;
  reason?: string;
}) {
  const expiresAt = new Date(Date.now() + COOLDOWN_MS).toISOString();
  const payload = JSON.stringify({
    expiresAt,
    reason: opts.reason || "Account deleted by admin",
    placedAt: new Date().toISOString(),
  });

  await prisma.siteSetting.upsert({
    where: { key: emailKey(opts.email) },
    create: { key: emailKey(opts.email), value: payload },
    update: { value: payload },
  });

  if (opts.phone && opts.phone.replace(/\D/g, "").length >= 7) {
    await prisma.siteSetting.upsert({
      where: { key: phoneKey(opts.phone) },
      create: { key: phoneKey(opts.phone), value: payload },
      update: { value: payload },
    });
  }

  return { expiresAt, hours: 72 };
}

export async function assertRegistrationAllowed(email: string, phone?: string | null) {
  const keys = [emailKey(email)];
  if (phone && phone.replace(/\D/g, "").length >= 7) keys.push(phoneKey(phone));

  for (const key of keys) {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    if (!row) continue;
    try {
      const data = JSON.parse(row.value) as { expiresAt: string };
      const exp = new Date(data.expiresAt).getTime();
      if (exp > Date.now()) {
        const hoursLeft = Math.ceil((exp - Date.now()) / (60 * 60 * 1000));
        throw new Error(
          `This email or phone was recently removed by an administrator. You can register again after the 72-hour waiting period (about ${hoursLeft} hour(s) left).`
        );
      }
      // Expired — clean up
      await prisma.siteSetting.delete({ where: { key } }).catch(() => null);
    } catch (e) {
      if (e instanceof Error && e.message.includes("72-hour")) throw e;
      // bad JSON — remove
      await prisma.siteSetting.delete({ where: { key } }).catch(() => null);
    }
  }
}
