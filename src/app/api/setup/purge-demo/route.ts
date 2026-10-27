import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_EMAILS = ["admin@buildforge.com", "client@example.com"];

/**
 * Remove known demo accounts and optionally all sample catalog data.
 * Requires x-setup-secret === SETUP_SECRET
 * Body: { purgeCatalog?: boolean } — if true, deletes all assets/tools/workers/finished projects
 */
export async function POST(req: NextRequest) {
  try {
    const setupSecret = process.env.SETUP_SECRET;
    if (!setupSecret) {
      return NextResponse.json({ error: "SETUP_SECRET not configured" }, { status: 503 });
    }
    const provided = req.headers.get("x-setup-secret");
    if (provided !== setupSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const purgeCatalog = !!body.purgeCatalog;

    const demoUsers = await prisma.user.findMany({
      where: { email: { in: DEMO_EMAILS } },
      select: { id: true, email: true },
    });

    for (const u of demoUsers) {
      await prisma.notification.deleteMany({ where: { userId: u.id } }).catch(() => null);
      await prisma.userDocument.deleteMany({ where: { userId: u.id } }).catch(() => null);
      await prisma.payment.deleteMany({ where: { userId: u.id } });
      await prisma.reservation.deleteMany({ where: { userId: u.id } });
      await prisma.toolRental.deleteMany({ where: { userId: u.id } });
      await prisma.hireRequest.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }

    let catalog = { assets: 0, tools: 0, workers: 0, finished: 0 };
    if (purgeCatalog) {
      await prisma.installmentDocument.deleteMany({}).catch(() => null);
      await prisma.installment.deleteMany({}).catch(() => null);
      await prisma.payment.deleteMany({});
      await prisma.reservation.deleteMany({});
      await prisma.toolRental.deleteMany({});
      await prisma.hireRequest.deleteMany({});
      await prisma.workerReview.deleteMany({}).catch(() => null);
      const a = await prisma.asset.deleteMany({});
      const t = await prisma.tool.deleteMany({});
      const w = await prisma.worker.deleteMany({});
      const f = await prisma.finishedProject.deleteMany({});
      catalog = { assets: a.count, tools: t.count, workers: w.count, finished: f.count };
    }

    return NextResponse.json({
      ok: true,
      removedDemoUsers: demoUsers.map((u) => u.email),
      purgedCatalog: purgeCatalog,
      catalog,
      message:
        "Demo accounts removed. Create a real admin via POST /api/setup/admin then add services in Admin.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Purge failed" },
      { status: 500 }
    );
  }
}
