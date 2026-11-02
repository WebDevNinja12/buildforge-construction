/** Legacy helper — package.json build no longer uses this. Kept for local use. */
import { spawnSync } from "node:child_process";
const env = { ...process.env };
const url =
  env.construction_storage_PRISMA_DATABASE_URL ||
  env.DATABASE_URL ||
  "postgresql://build:build@127.0.0.1:5432/build";
env.construction_storage_PRISMA_DATABASE_URL = url;
env.DATABASE_URL = url;
function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: true });
  if (r.status !== 0) process.exit(r.status || 1);
}
run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
