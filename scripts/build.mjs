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
    const t = c.trim();
    if (t.startsWith("postgresql://") || t.startsWith("postgres://")) return t;
  }
  return null;
}

const neon = pickUrl();
if (neon) {
  process.env.construction_storage_PRISMA_DATABASE_URL = neon;
  process.env.DATABASE_URL = neon;
  console.log("[build] Using Neon postgres URL");
} else {
  process.env.construction_storage_PRISMA_DATABASE_URL =
    "postgresql://build:build@127.0.0.1:5432/build?schema=public";
  console.warn("[build] No neon URL — placeholder for generate only");
}

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env, shell: true });
  if (r.status !== 0) process.exit(r.status || 1);
}

run("npx", ["prisma", "generate"]);

if (neon) {
  console.log("[build] Pushing Prisma schema…");
  let ok = false;
  for (let i = 0; i < 2; i++) {
    const push = spawnSync(
      "npx",
      ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
      { stdio: "inherit", env: process.env, shell: true }
    );
    if (push.status === 0) {
      ok = true;
      console.log("[build] Database schema pushed");
      break;
    }
    console.warn(`[build] prisma db push attempt ${i + 1} failed`);
  }
  if (!ok) {
    console.error("[build] prisma db push failed — continuing with explicit ALTERs");
  }

  // Explicit columns so login never dies on User.nin etc.
  const alters = [
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nin" TEXT',
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bvn" TEXT',
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nextOfKinJson" TEXT',
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT',
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "historyClearedAt" TIMESTAMP(3)',
    'ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "previousFileUrl" TEXT',
    'ALTER TABLE "InstallmentDocument" ADD COLUMN IF NOT EXISTS "previousRejectReason" TEXT',
  ];
  for (const sql of alters) {
    const r = spawnSync(
      "npx",
      ["prisma", "db", "execute", "--stdin"],
      {
        input: sql + ";",
        encoding: "utf8",
        env: process.env,
        shell: true,
      }
    );
    if (r.status === 0) console.log("[build] OK:", sql.slice(0, 60));
    else console.warn("[build] ALTER skip/fail:", sql.slice(0, 50), r.stderr || r.stdout);
  }
} else {
  console.warn("[build] Skipping db push (no real URL)");
}

run("npx", ["next", "build"]);
