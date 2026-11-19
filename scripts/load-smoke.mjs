#!/usr/bin/env node
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const paths = ["/", "/services", "/quote", "/privacy", "/terms", "/login", "/api/assets", "/api/tools"];

async function hit(path) {
  const url = base + path;
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html,application/json" },
      redirect: "follow",
    });
    const ms = Date.now() - t0;
    const ok = res.status < 500;
    console.log(`${ok ? "OK " : "ERR"} ${res.status} ${ms}ms  ${path}`);
    return { path, status: res.status, ms, ok };
  } catch (e) {
    console.log(`ERR 000 ${Date.now() - t0}ms  ${path}  ${e.message}`);
    return { path, status: 0, ms: Date.now() - t0, ok: false };
  }
}

const results = [];
for (const p of paths) {
  results.push(await hit(p));
  await new Promise((r) => setTimeout(r, 80));
}
const failed = results.filter((r) => !r.ok);
const avg = Math.round(results.reduce((s, r) => s + r.ms, 0) / results.length);
console.log("\n---");
console.log(`Base: ${base}`);
console.log(`Avg latency: ${avg}ms`);
console.log(`Failed: ${failed.length}/${results.length}`);
process.exit(failed.length ? 1 : 0);
