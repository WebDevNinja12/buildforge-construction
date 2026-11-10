import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

/**
 * Clear demo/sample catalog. Payments are always kept.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (String(body.confirm || "") !== "CLEAR CATALOG") {
      return NextResponse.json(
        { error: "Confirmation required", hint: 'Send { "confirm": "CLEAR CATALOG" }' },
        { status: 400 }
      );
    }

    const clearAssets = body.assets !== false;
    const clearTools = body.tools !== false;
    const clearWorkers = body.workers !== false;
    const clearTx = body.transactions !== false;
    const counts: Record<string, number> = { paymentsKept: 0 };

    try {
      counts.paymentsKept = await prisma.payment.count();
    } catch {
      counts.paymentsKept = 0;
    }

    if (clearTx || clearAssets) {
      // Do NOT delete payments
      counts.reservations = (
        await prisma.reservation.deleteMany({}).catch(() => ({ count: 0 }))
      ).count;
      await prisma.installmentDocument.deleteMany({}).catch(() => null);
      await prisma.contract.deleteMany({}).catch(() => null);
    }
    if (clearTx || clearTools) {
      counts.rentals = (await prisma.toolRental.deleteMany({}).catch(() => ({ count: 0 }))).count;
    }
    if (clearTx || clearWorkers) {
      counts.hires = (await prisma.hireRequest.deleteMany({}).catch(() => ({ count: 0 }))).count;
      await prisma.workerReview.deleteMany({}).catch(() => null);
    }
    if (clearAssets) {
      counts.assets = (await prisma.asset.deleteMany({}).catch(() => ({ count: 0 }))).count;
    }
    if (clearTools) {
      counts.tools = (await prisma.tool.deleteMany({}).catch(() => ({ count: 0 }))).count;
    }
    if (clearWorkers) {
      counts.workers = (await prisma.worker.deleteMany({}).catch(() => ({ count: 0 }))).count;
    }

    if (body.finishedProjects === true) {
      counts.finished = (
        await prisma.finishedProject.deleteMany({}).catch(() => ({ count: 0 }))
      ).count;
    }
    if (body.projects === true) {
      counts.projects = (await prisma.project.deleteMany({}).catch(() => ({ count: 0 }))).count;
    }

    await recordAdminActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      action: "PURGE_CATALOG",
      entity: "System",
      details: counts,
    });

    return NextResponse.json({
      ok: true,
      counts,
      message:
        "Demo catalog cleared. Payment records were kept. Add real services, tools, and workers from Admin.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Purge failed" },
      { status: 500 }
    );
  }
}
