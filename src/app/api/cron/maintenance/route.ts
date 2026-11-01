import { NextRequest, NextResponse } from "next/server";
import { runMaintenance } from "@/lib/maintenance";

/** Hourly cron — reservation expiry, auto-approve, reminders */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET || process.env.SETUP_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    // Vercel Cron sends special header in production; allow when CRON_SECRET unset in preview
    const isVercelCron = req.headers.get("x-vercel-cron") === "1";
    if (!isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  try {
    await runMaintenance();
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Maintenance failed" }, { status: 500 });
  }
}
