import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { runMaintenance } from "@/lib/maintenance";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  await runMaintenance().catch(() => null);

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") || 100), 500);

  const [
    logs,
    reservations,
    rentals,
    hires,
    payments,
    pendingUsers,
    expiringSoon,
    revenue,
  ] = await Promise.all([
    prisma.adminActivityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { admin: { select: { id: true, name: true, email: true } } },
    }),
    prisma.reservation.findMany({
      include: { user: { select: { id: true, name: true, email: true } }, asset: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.toolRental.findMany({
      include: { user: { select: { id: true, name: true, email: true } }, tool: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.hireRequest.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        worker: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.payment.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        reservation: { include: { asset: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.count({ where: { status: "PENDING_APPROVAL", role: "CLIENT" } }),
    prisma.reservation.count({
      where: {
        status: "PENDING",
        expiresAt: { lte: new Date(Date.now() + 48 * 3600 * 1000), gte: new Date() },
      },
    }),
    prisma.payment.aggregate({
      where: { status: { in: ["APPROVED", "COMPLETED"] } },
      _sum: { amount: true },
    }),
  ]);

  return NextResponse.json({
    logs,
    pendingApprovals: pendingUsers,
    expiringSoon,
    revenue: revenue._sum.amount || 0,
    pendingPayments: payments.filter((p) => p.status === "PENDING").length,
    reservations,
    rentals,
    hires,
    payments,
  });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";
  const before = searchParams.get("before");
  const id = searchParams.get("id");

  try {
    if (id) {
      await prisma.adminActivityLog.delete({ where: { id } }).catch(() => null);
      return NextResponse.json({ ok: true, deleted: 1 });
    }

    if (before) {
      const date = new Date(before);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "Invalid before date" }, { status: 400 });
      }
      const result = await prisma.adminActivityLog.deleteMany({
        where: { createdAt: { lt: date } },
      });
      await prisma.adminActivityLog.create({
        data: {
          adminId: admin.id,
          action: "CLEAR_LOG_BEFORE",
          entity: "AdminActivityLog",
          details: JSON.stringify({ before: date.toISOString(), deleted: result.count }),
        },
      });
      return NextResponse.json({ ok: true, deleted: result.count });
    }

    if (all) {
      const result = await prisma.adminActivityLog.deleteMany({});
      await prisma.adminActivityLog.create({
        data: {
          adminId: admin.id,
          action: "CLEAR_ALL_HISTORY",
          entity: "AdminActivityLog",
          details: JSON.stringify({ deleted: result.count, at: new Date().toISOString() }),
        },
      });
      return NextResponse.json({
        ok: true,
        deleted: result.count,
        message: "Activity history cleared",
      });
    }

    return NextResponse.json(
      { error: "Specify all=1, before=YYYY-MM-DD, or id=..." },
      { status: 400 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to clear history" }, { status: 500 });
  }
}
