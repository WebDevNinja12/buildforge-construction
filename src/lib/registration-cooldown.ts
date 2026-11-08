import { prisma } from "@/lib/prisma";
import { healSchema } from "@/lib/schema-heal";

const COOLDOWN_MS = 72 * 60 * 60 * 1000; // 72 hours
let healed = false;

async function ensureSiteSettingTable() {
  if (healed) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SiteSetting" (
        "id" TEXT PRIMARY KEY,
        "key" TEXT NOT NULL UNIQUE,
        "value" TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "SiteSetting" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL`
    );
  } catch {
    /* */
  }
  try {
    await healSchema();
  } catch {
    /* */
  }
  healed = true;
}

function emailKey(email: string) {
  return `reg_cooldown_email_${email.trim().toLowerCase()}`;
}

function phoneKey(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `reg_cooldown_phone_${digits}`;
}

function newId() {
  return `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function upsertSetting(key: string, value: string) {
  await ensureSiteSettingTable();
  try {
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
    return;
  } catch {
    /* fall through to raw SQL */
  }
  const id = newId();
  try {
    await prisma.$executeRaw`
      INSERT INTO "SiteSetting" ("id", "key", "value", "updatedAt")
      VALUES (${id}, ${key}, ${value}, CURRENT_TIMESTAMP)
      ON CONFLICT ("key") DO UPDATE SET "value" = ${value}, "updatedAt" = CURRENT_TIMESTAMP
    `;
  } catch {
    try {
      await prisma.$executeRaw`
        INSERT INTO "SiteSetting" ("id", "key", "value")
        VALUES (${id}, ${key}, ${value})
        ON CONFLICT ("key") DO UPDATE SET "value" = ${value}
      `;
    } catch {
      /* ignore cooldown storage failure — do not block registration */
    }
  }
}

async function findSetting(key: string): Promise<string | null> {
  await ensureSiteSettingTable();
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    try {
      const rows = await prisma.$queryRaw<{ value: string }[]>`
        SELECT "value" FROM "SiteSetting" WHERE "key" = ${key} LIMIT 1
      `;
      return rows?.[0]?.value ?? null;
    } catch {
      return null;
    }
  }
}

async function deleteSetting(key: string) {
  try {
    await prisma.siteSetting.delete({ where: { key } });
  } catch {
    try {
      await prisma.$executeRaw`DELETE FROM "SiteSetting" WHERE "key" = ${key}`;
    } catch {
      /* */
    }
  }
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

  await upsertSetting(emailKey(opts.email), payload);

  if (opts.phone && opts.phone.replace(/\D/g, "").length >= 7) {
    await upsertSetting(phoneKey(opts.phone), payload);
  }

  return { expiresAt, hours: 72 };
}

export async function assertRegistrationAllowed(email: string, phone?: string | null) {
  const keys = [emailKey(email)];
  if (phone && phone.replace(/\D/g, "").length >= 7) keys.push(phoneKey(phone));

  for (const key of keys) {
    const value = await findSetting(key);
    if (!value) continue;
    try {
      const data = JSON.parse(value) as { expiresAt: string };
      const exp = new Date(data.expiresAt).getTime();
      if (exp > Date.now()) {
        const hoursLeft = Math.ceil((exp - Date.now()) / (60 * 60 * 1000));
        throw new Error(
          `This email or phone was recently removed by an administrator. You can register again after the 72-hour waiting period (about ${hoursLeft} hour(s) left).`
        );
      }
      await deleteSetting(key);
    } catch (e) {
      if (e instanceof Error && e.message.includes("72-hour")) throw e;
      await deleteSetting(key);
    }
  }
}
