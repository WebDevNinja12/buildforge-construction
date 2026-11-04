import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEMO_EMAILS = [
  "admin@buildforge.com",
  "client@example.com",
  "demo@example.com",
  "test@example.com",
  "user@example.com",
  "admin@example.com",
];

/**
 * Remove demo accounts and all catalog/transaction sample data.
 * Auth (any one):
 *  - header x-setup-secret === SETUP_SECRET
 *  - SETUP_ALLOW_RESET=true + body.confirm === "PURGE ALL DEMO"
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const setupSecret = process.env.SETUP_SECRET;
    const provided = req.headers.get("x-setup-secret");
    const allowReset = process.env.SETUP_ALLOW_RESET === "true";
    const confirmed = String(body.confirm || "") === "PURGE ALL DEMO";

    const authorized =
      (setupSecret && provided === setupSecret) || (allowReset && confirmed);

    if (!authorized) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          hint: allowReset
            ? 'Send { "confirm": "PURGE ALL DEMO", "purgeCatalog": true }'
            : "Provide x-setup-secret header",
        },
        { status: 401 }
      );
    }

    const purgeCatalog = body.purgeCatalog !== false; // default true when purging demo

    // 1) Demo users
    const demoUsers = await prisma.user.findMany({
      where: { email: { in: DEMO_EMAILS } },
      select: { id: true, email: true },
    });

    for (const u of demoUsers) {
      await prisma.notification.deleteMany({ where: { userId: u.id } }).catch(() => null);
      await prisma.userDocument.deleteMany({ where: { userId: u.id } }).catch(() => null);
      await prisma.installmentDocument.deleteMany({ where: { userId: u.id } }).catch(() => null);
      await prisma.payment.deleteMany({ where: { userId: u.id } }).catch(() => null);
      await prisma.reservation.deleteMany({ where: { userId: u.id } }).catch(() => null);
      await prisma.toolRental.deleteMany({ where: { userId: u.id } }).catch(() => null);
      await prisma.hireRequest.deleteMany({ where: { userId: u.id } }).catch(() => null);
      await prisma.contract.deleteMany({ where: { userId: u.id } }).catch(() => null);
      await prisma.quoteRequest.deleteMany({ where: { userId: u.id } }).catch(() => null);
      await prisma.user.delete({ where: { id: u.id } }).catch(() => null);
    }

    const catalog = {
      payments: 0,
      reservations: 0,
      rentals: 0,
      hires: 0,
      assets: 0,
      tools: 0,
      workers: 0,
      finished: 0,
      projects: 0,
      reviews: 0,
    };

    if (purgeCatalog) {
      // Order matters for FKs
      const pay = await prisma.payment.deleteMany({}).catch(() => ({ count: 0 }));
      const res = await prisma.reservation.deleteMany({}).catch(() => ({ count: 0 }));
      const rent = await prisma.toolRental.deleteMany({}).catch(() => ({ count: 0 }));
      const hire = await prisma.hireRequest.deleteMany({}).catch(() => ({ count: 0 }));
      await prisma.installmentDocument.deleteMany({}).catch(() => null);
      await prisma.contract.deleteMany({}).catch(() => null);
      await prisma.workerReview.deleteMany({}).catch(() => null);
      const a = await prisma.asset.deleteMany({}).catch(() => ({ count: 0 }));
      const t = await prisma.tool.deleteMany({}).catch(() => ({ count: 0 }));
      const w = await prisma.worker.deleteMany({}).catch(() => ({ count: 0 }));
      const f = await prisma.finishedProject.deleteMany({}).catch(() => ({ count: 0 }));
      const p = await prisma.project.deleteMany({}).catch(() => ({ count: 0 }));

      catalog.payments = pay.count;
      catalog.reservations = res.count;
      catalog.rentals = rent.count;
      catalog.hires = hire.count;
      catalog.assets = a.count;
      catalog.tools = t.count;
      catalog.workers = w.count;
      catalog.finished = f.count;
      catalog.projects = p.count;
    }

    return NextResponse.json({
      ok: true,
      removedDemoUsers: demoUsers.map((u) => u.email),
      purgedCatalog: purgeCatalog,
      catalog,
      message:
        "Demo/sample data removed. Keep only real admin. Add real services, tools, and workers in Admin.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Purge failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    hint: 'POST { "confirm": "PURGE ALL DEMO", "purgeCatalog": true } when SETUP_ALLOW_RESET=true',
  });
}
