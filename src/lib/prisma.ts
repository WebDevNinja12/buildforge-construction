import { PrismaClient } from "@prisma/client";

/**
 * Neon / Vercel may expose the connection under several names.
 * Prisma schema expects DATABASE_URL — set it before the client is created.
 */
function resolveDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.construction_storage_PRISMA_DATABASE_URL,
    process.env.construction_storage_DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const trimmed = c.trim();
    if (
      trimmed.startsWith("postgresql://") ||
      trimmed.startsWith("postgres://")
    ) {
      return trimmed;
    }
  }
  return undefined;
}

const resolved = resolveDatabaseUrl();
if (resolved) {
  process.env.DATABASE_URL = resolved;
} else {
  console.error(
    "[prisma] No valid postgres URL found. Checked construction_storage_PRISMA_DATABASE_URL, POSTGRES_*, DATABASE_URL"
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export function getDatabaseUrlStatus() {
  const raw = process.env.DATABASE_URL || "";
  return {
    hasUrl: !!raw,
    looksLikePostgres:
      raw.startsWith("postgresql://") || raw.startsWith("postgres://"),
    sourceHint: resolved
      ? "resolved from Neon/Postgres env"
      : "missing or invalid",
  };
}
