import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { runMaintenance } from "@/lib/maintenance";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const maintenance = await runMaintenance();
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [
    totalUsers,
    pendingReviews,
    underReview,
    activeReservations,
    expiringReservations,
    pendingPayments,
    revenueAgg,
    recentLogs,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.user.count({
      where: {
        role: "CLIENT",
        OR: [
          { status: "PENDING_APPROVAL" },
          { verificationStatus: { in: ["PENDING", "UNDER_REVIEW", "REUPLOAD_REQUIRED"] } },
        ],
      },
    }),
    prisma.user.count({ where: { verificationStatus: "UNDER_REVIEW" } }),
    prisma.reservation.count({
      where: { status: { in: ["PENDING", "CONFIRMED", "PARTIALLY_PAID"] } },
    }),
    prisma.reservation.count({
      where: {
        status: "PENDING",
        expiresAt: { lte: in48h, gte: now },
      },
    }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.payment.aggregate({
      where: { status: { in: ["APPROVED", "COMPLETED"] } },
      _sum: { amount: true },
    }),
    prisma.adminActivityLog.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { admin: { select: { name: true, email: true } } },
    }).catch(() => []),
  ]);

  return NextResponse.json({
    stats: {
      totalUsers,
      pendingReviews,
      underReview,
      activeReservations,
      expiringReservations,
      pendingPayments,
      revenue: revenueAgg._sum.amount || 0,
    },
    maintenance,
    recentLogs,
  });
}
