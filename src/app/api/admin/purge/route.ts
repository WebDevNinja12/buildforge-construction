import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

/**
 * Clear demo/sample catalog and related holds.
 * Payments and admin/real client accounts are always kept.
 *
 * Body: { "confirm": "CLEAR CATALOG" }
 * Optional flags (default true): assets, tools, workers, transactions, finishedProjects, projects
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
    const clearFinished = body.finishedProjects !== false;
    const clearProjects = body.projects !== false;

    const counts: Record<string, number> = { paymentsKept: 0 };

    try {
      counts.paymentsKept = await prisma.payment.count();
    } catch {
      counts.paymentsKept = 0;
    }

    if (clearTx || clearAssets) {
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
    if (clearFinished) {
      counts.finished = (
        await prisma.finishedProject.deleteMany({}).catch(() => ({ count: 0 }))
      ).count;
    }
    if (clearProjects) {
      counts.projects = (await prisma.project.deleteMany({}).catch(() => ({ count: 0 }))).count;
    }

    const DEMO_EMAILS = [
      "client@example.com",
      "demo@example.com",
      "test@example.com",
      "user@example.com",
      "admin@example.com",
      "admin@buildforge.com",
    ];
    if (body.demoUsers !== false) {
      const demoUsers = await prisma.user
        .findMany({
          where: {
            email: { in: DEMO_EMAILS },
            role: { not: "ADMIN" },
          },
          select: { id: true, email: true },
        })
        .catch(() => [] as { id: string; email: string }[]);
      for (const u of demoUsers) {
        await prisma.notification.deleteMany({ where: { userId: u.id } }).catch(() => null);
        await prisma.userDocument.deleteMany({ where: { userId: u.id } }).catch(() => null);
        await prisma.user.delete({ where: { id: u.id } }).catch(() => null);
      }
      counts.demoUsersRemoved = demoUsers.length;
    }

    await recordAdminActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      action: "CATALOG_PURGE",
      entity: "Catalog",
      details: counts,
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      message:
        "Demo catalog cleared. Payments kept. Admin and real clients kept. Add real services under Admin.",
      counts,
    });
  } catch (e) {
    console.error("purge", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Purge failed" },
      { status: 500 }
    );
  }
}
