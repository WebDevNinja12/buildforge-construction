import { prisma } from "@/lib/prisma";

export const MAINTENANCE_KEY = "maintenance_mode";
export const MAINTENANCE_MESSAGE_KEY = "maintenance_message";
export const LOCK_REGISTER_KEY = "lock_registration";
export const LOCK_CLIENT_LOGIN_KEY = "lock_client_login";

const DEFAULT_MESSAGE =
  "Hama Construction is under maintenance. Login and new account registration are temporarily unavailable. Please try again later.";

async function ensureTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SiteSetting" (
        "id" TEXT PRIMARY KEY,
        "key" TEXT NOT NULL UNIQUE,
        "value" TEXT NOT NULL,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch {
    /* */
  }
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "SiteSetting" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP`
    );
  } catch {
    /* */
  }
}

async function getValue(key: string): Promise<string | null> {
  await ensureTable();
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ value: string }>>(
        `SELECT value FROM "SiteSetting" WHERE key = $1 LIMIT 1`,
        key
      );
      return rows[0]?.value ?? null;
    } catch {
      return null;
    }
  }
}

async function setValue(key: string, value: string) {
  await ensureTable();
  try {
    await prisma.siteSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  } catch {
    const id = `ss_${key}_${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "SiteSetting" (id, key, value, "updatedAt")
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = CURRENT_TIMESTAMP`,
      id,
      key,
      value
    );
  }
}

export type SiteAccessMode = {
  maintenanceMode: boolean;
  lockClientLogin: boolean;
  lockRegistration: boolean;
  message: string;
};

export async function getSiteAccessMode(): Promise<SiteAccessMode> {
  const [maint, lockLogin, lockReg, msg] = await Promise.all([
    getValue(MAINTENANCE_KEY),
    getValue(LOCK_CLIENT_LOGIN_KEY),
    getValue(LOCK_REGISTER_KEY),
    getValue(MAINTENANCE_MESSAGE_KEY),
  ]);

  const maintenanceMode = maint === "true" || maint === "1";
  const lockClientLogin =
    lockLogin === "true" || lockLogin === "1" || (maintenanceMode && lockLogin !== "false");
  const lockRegistration =
    lockReg === "true" || lockReg === "1" || (maintenanceMode && lockReg !== "false");

  return {
    maintenanceMode,
    lockClientLogin,
    lockRegistration,
    message: (msg && msg.trim()) || DEFAULT_MESSAGE,
  };
}

export async function setSiteAccessMode(opts: {
  maintenanceMode?: boolean;
  lockClientLogin?: boolean;
  lockRegistration?: boolean;
  message?: string;
}) {
  if (opts.maintenanceMode !== undefined) {
    await setValue(MAINTENANCE_KEY, opts.maintenanceMode ? "true" : "false");
    if (opts.maintenanceMode) {
      if (opts.lockClientLogin === undefined) await setValue(LOCK_CLIENT_LOGIN_KEY, "true");
      if (opts.lockRegistration === undefined) await setValue(LOCK_REGISTER_KEY, "true");
    }
  }
  if (opts.lockClientLogin !== undefined) {
    await setValue(LOCK_CLIENT_LOGIN_KEY, opts.lockClientLogin ? "true" : "false");
  }
  if (opts.lockRegistration !== undefined) {
    await setValue(LOCK_REGISTER_KEY, opts.lockRegistration ? "true" : "false");
  }
  if (opts.message !== undefined) {
    await setValue(MAINTENANCE_MESSAGE_KEY, String(opts.message).slice(0, 500));
  }
  return getSiteAccessMode();
}

export async function assertClientLoginAllowed(): Promise<{ ok: true } | { ok: false; message: string }> {
  const mode = await getSiteAccessMode();
  if (mode.lockClientLogin || mode.maintenanceMode) {
    return { ok: false, message: mode.message };
  }
  return { ok: true };
}

export async function assertRegistrationAllowedBySite(): Promise<
  { ok: true } | { ok: false; message: string }
> {
  const mode = await getSiteAccessMode();
  if (mode.lockRegistration || mode.maintenanceMode) {
    return { ok: false, message: mode.message };
  }
  return { ok: true };
}
