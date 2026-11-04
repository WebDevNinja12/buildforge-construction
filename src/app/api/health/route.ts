import { NextResponse } from "next/server";
import { prisma, getDatabaseUrlStatus } from "@/lib/prisma";
import { blobStatus } from "@/lib/media";
import { healSchema } from "@/lib/schema-heal";

export const dynamic = "force-dynamic";

export async function GET() {
  const urlStatus = getDatabaseUrlStatus();
  let db: { ok: boolean; userCount?: number; error?: string } = { ok: false };
  let heal: string[] = [];

  try {
    heal = await healSchema();
  } catch (e) {
    heal = [e instanceof Error ? e.message : "heal failed"];
  }

  try {
    const userCount = await prisma.user.count();
    db = { ok: true, userCount };
  } catch (e) {
    db = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const blob = blobStatus();

  return NextResponse.json({
    ok: db.ok,
    buildId: "hama-2026-11-04-reserve-heal",
    databaseUrl: urlStatus,
    db,
    schemaHeal: {
      total: heal.length,
      ok: heal.filter((h) => h === "ok").length,
      sample: heal.filter((h) => h !== "ok").slice(0, 5),
    },
    blob,
    note: "Asset.image and Reservation payment columns healed for reservations.",
  });
}
