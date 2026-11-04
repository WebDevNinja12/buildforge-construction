import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Admin-only: clear sample catalog so only real listings remain.
 * Body: { confirm: "CLEAR CATALOG", assets?: boolean, tools?: boolean, workers?: boolean, transactions?: boolean }
 * Defaults: clear all catalog + related transactions when confirm matches.
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
        {
          error: "Confirmation required",
          hint: 'Send { "confirm": "CLEAR CATALOG" }',
        },
        { status: 400 }
      );
    }

    const clearAssets = body.assets !== false;
    const clearTools = body.tools !== false;
    const clearWorkers = body.workers !== false;
    const clearTx = body.transactions !== false;

    const counts: Record<string, number> = {};

    if (clearTx || clearAssets) {
      const pay = await prisma.payment.deleteMany({}).catch(() => ({ count: 0 }));
      counts.payments = pay.count;
      const res = await prisma.reservation.deleteMany({}).catch(() => ({ count: 0 }));
      counts.reservations = res.count;
      await prisma.installmentDocument.deleteMany({}).catch(() => null);
      await prisma.contract.deleteMany({}).catch(() => null);
    }
    if (clearTx || clearTools) {
      const rent = await prisma.toolRental.deleteMany({}).catch(() => ({ count: 0 }));
      counts.rentals = rent.count;
    }
    if (clearTx || clearWorkers) {
      const hire = await prisma.hireRequest.deleteMany({}).catch(() => ({ count: 0 }));
      counts.hires = hire.count;
      await prisma.workerReview.deleteMany({}).catch(() => null);
    }
    if (clearAssets) {
      const a = await prisma.asset.deleteMany({}).catch(() => ({ count: 0 }));
      counts.assets = a.count;
    }
    if (clearTools) {
      const t = await prisma.tool.deleteMany({}).catch(() => ({ count: 0 }));
      counts.tools = t.count;
    }
    if (clearWorkers) {
      const w = await prisma.worker.deleteMany({}).catch(() => ({ count: 0 }));
      counts.workers = w.count;
    }

    await prisma.adminActivityLog
      .create({
        data: {
          adminId: session.id,
          action: "PURGE_CATALOG",
          entity: "System",
          entityId: null,
          details: JSON.stringify(counts),
        },
      })
      .catch(() => null);

    return NextResponse.json({
      ok: true,
      counts,
      message: "Catalog cleared. Add real services, tools, and workers from Admin.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Purge failed" },
      { status: 500 }
    );
  }
}
