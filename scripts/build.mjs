import { spawnSync } from "node:child_process";

// Neon integration often exposes construction_storage_PRISMA_DATABASE_URL
const neon =
  process.env.construction_storage_PRISMA_DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL;

if (neon) {
  process.env.DATABASE_URL = neon;
} else if (!process.env.DATABASE_URL) {
  // Allow `prisma generate` during build without a live DB
  process.env.DATABASE_URL =
    "postgresql://build:build@127.0.0.1:5432/build?schema=public";
  console.warn("[build] DATABASE_URL missing — using placeholder for prisma generate only");
}

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env, shell: true });
  if (r.status !== 0) process.exit(r.status || 1);
}

run("npx", ["prisma", "generate"]);

// Best-effort schema sync (do not fail the whole build)
const push = spawnSync(
  "npx",
  ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
  { stdio: "inherit", env: process.env, shell: true }
);
if (push.status !== 0) {
  console.warn("[build] prisma db push failed — continuing to next build");
}

run("npx", ["next", "build"]);
