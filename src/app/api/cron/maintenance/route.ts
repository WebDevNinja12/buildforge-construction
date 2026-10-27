import { NextRequest, NextResponse } from "next/server";
import { runMaintenance, ensureCategoryDefaults } from "@/lib/maintenance";

/** Call from Vercel Cron or manually. Optional header x-cron-secret. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await ensureCategoryDefaults().catch(() => null);
    const result = await runMaintenance();
    return NextResponse.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
