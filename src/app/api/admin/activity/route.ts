import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { runMaintenance } from "@/lib/maintenance";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  await runMaintenance();

  const [
    reservations,
    rentals,
    hires,
    payments,
    pendingUsers,
    counts,
    expiringSoon,
    revenue,
  ] = await Promise.all([
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
    prisma.user.groupBy({
      by: ["status"],
      where: { role: "CLIENT" },
      _count: true,
    }).catch(() => []),
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
    pendingApprovals: pendingUsers,
    statusCounts: counts,
    expiringSoon,
    revenue: revenue._sum.amount || 0,
    pendingPayments: payments.filter((p) => p.status === "PENDING").length,
    reservations,
    rentals,
    hires,
    payments,
  });
}
