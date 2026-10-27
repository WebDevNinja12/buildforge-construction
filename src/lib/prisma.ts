import { PrismaClient } from "@prisma/client";

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
  const raw = process.env.construction_storage_PRISMA_DATABASE_URL || "";
  return {
    hasUrl: !!raw,
    looksLikePostgres:
      raw.startsWith("postgresql://") || raw.startsWith("postgres://"),
    envName: "construction_storage_PRISMA_DATABASE_URL",
  };
}
