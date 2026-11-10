import { PrismaClient } from "@prisma/client";

/**
 * Serverless-safe Prisma client.
 * Neon + Vercel: many cold starts can exhaust the role connection limit
 * (especially roles like prisma_migration). Cap to 1 connection per instance
 * and prefer pooled URLs when possible.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDatasourceUrl(): string | undefined {
  const raw =
    process.env.construction_storage_PRISMA_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    "";
  if (!raw) return undefined;

  try {
    const u = new URL(raw);
    // Cap connections per serverless instance (critical for Neon free / migration roles)
    if (!u.searchParams.has("connection_limit")) {
      u.searchParams.set("connection_limit", "1");
    }
    // Enable pgbouncer mode when using Neon pooler host or explicit flag
    const host = u.hostname || "";
    if (host.includes("-pooler.") || host.includes("pooler.")) {
      if (!u.searchParams.has("pgbouncer")) {
        u.searchParams.set("pgbouncer", "true");
      }
    }
    // Avoid prepared-statement issues with PgBouncer transaction mode
    if (u.searchParams.get("pgbouncer") === "true" && !u.searchParams.has("statement_cache_size")) {
      u.searchParams.set("statement_cache_size", "0");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function createClient(): PrismaClient {
  const url = resolveDatasourceUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(url
      ? {
          datasources: {
            db: { url },
          },
        }
      : {}),
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

// Always cache on globalThis so warm serverless instances reuse the client
globalForPrisma.prisma = prisma;

export function getDatabaseUrlStatus() {
  const raw =
    process.env.construction_storage_PRISMA_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "";
  const resolved = resolveDatasourceUrl() || "";
  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    /* */
  }
  return {
    hasUrl: !!raw,
    looksLikePostgres:
      raw.startsWith("postgresql://") || raw.startsWith("postgres://"),
    envName: process.env.construction_storage_PRISMA_DATABASE_URL
      ? "construction_storage_PRISMA_DATABASE_URL"
      : "DATABASE_URL",
    isPoolerHost: host.includes("pooler"),
    hasConnectionLimit: resolved.includes("connection_limit="),
  };
}
