import { NextRequest, NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

/** Cron + manual heal: reservation expiry, free stuck assets, auto-approve */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET || process.env.SETUP_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const force = new URL(req.url).searchParams.get("force") === "1";

  if (secret && auth !== `Bearer ${secret}` && !isVercelCron && !force) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runMaintenance();
    return NextResponse.json({ ok: true, at: new Date().toISOString(), ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Maintenance failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
