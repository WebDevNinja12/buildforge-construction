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
  process.env.DATABASE_URL = neon;
  console.log("[build] Using Neon/Postgres URL for prisma");
} else {
  process.env.DATABASE_URL =
    "postgresql://build:build@127.0.0.1:5432/build?schema=public";
  console.warn("[build] No postgres URL — placeholder for generate only");
}

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env, shell: true });
  if (r.status !== 0) process.exit(r.status || 1);
}

run("npx", ["prisma", "generate"]);

if (neon) {
  const push = spawnSync(
    "npx",
    ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
    { stdio: "inherit", env: process.env, shell: true }
  );
  if (push.status !== 0) {
    console.warn("[build] prisma db push failed — continuing");
  } else {
    console.log("[build] Database schema pushed");
  }
} else {
  console.warn("[build] Skipping db push (no real DATABASE_URL)");
}

run("npx", ["next", "build"]);
