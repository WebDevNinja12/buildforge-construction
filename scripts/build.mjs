/**
 * Vercel build — generate Prisma client only.
 * Do NOT run `prisma db push` here (causes invalid_db_setup on Neon).
 * Schema is healed at runtime via /api/db-heal and login migrate.
 */
import { spawnSync } from "node:child_process";

function pickUrl() {
  const candidates = [
    process.env.construction_storage_PRISMA_DATABASE_URL,
    process.env.construction_storage_DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const t = String(c).trim();
    if (t.startsWith("postgresql://") || t.startsWith("postgres://")) return t;
  }
  return null;
}

const neon = pickUrl();
if (neon) {
  process.env.construction_storage_PRISMA_DATABASE_URL = neon;
  process.env.DATABASE_URL = neon;
  console.log("[build] DATABASE URL present — generate only (no db push)");
} else {
  process.env.construction_storage_PRISMA_DATABASE_URL =
    "postgresql://build:build@127.0.0.1:5432/build?schema=public";
  console.warn("[build] No DB URL — placeholder for prisma generate");
}

function run(cmd, args) {
  console.log(">", cmd, args.join(" "));
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env, shell: true });
  if (r.status !== 0) process.exit(r.status || 1);
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
console.log("[build] OK");
