import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { runMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const maintenance = await runMaintenance().catch(() => null);
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [
    totalUsers,
    pendingReviews,
    underReview,
    activeReservations,
    activeInstallments,
    expiringReservations,
    pendingPayments,
    toolRentals,
    revenueAgg,
    recentLogs,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "CLIENT", deletedAt: null } }),
    prisma.user.count({
      where: {
        role: "CLIENT",
        deletedAt: null,
        OR: [
          { status: "PENDING_APPROVAL" },
          { verificationStatus: { in: ["PENDING", "UNDER_REVIEW", "REUPLOAD_REQUIRED"] } },
        ],
      },
    }),
    prisma.user.count({ where: { verificationStatus: "UNDER_REVIEW", deletedAt: null } }),
    prisma.reservation.count({
      where: { status: { in: ["PENDING", "CONFIRMED", "PARTIALLY_PAID", "INSTALLMENT_PLAN"] } },
    }),
    prisma.reservation.count({
      where: {
        paymentType: "INSTALLMENT",
        status: { in: ["PENDING", "CONFIRMED", "PARTIALLY_PAID", "INSTALLMENT_PLAN"] },
      },
    }),
    prisma.reservation.count({
      where: {
        status: "PENDING",
        expiresAt: { lte: in48h, gte: now },
      },
    }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.toolRental.count({
      where: { status: { in: ["PENDING", "ACTIVE", "CONFIRMED"] } },
    }),
    prisma.payment.aggregate({
      where: { status: { in: ["APPROVED", "COMPLETED"] } },
      _sum: { amount: true },
    }),
    prisma.adminActivityLog
      .findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: { admin: { select: { name: true, email: true } } },
      })
      .catch(() => []),
  ]);

  let overduePayments = 0;
  try {
    overduePayments = await prisma.reservation.count({
      where: {
        paymentType: "INSTALLMENT",
        nextDueAt: { lt: now },
        status: { in: ["PENDING", "PARTIALLY_PAID", "INSTALLMENT_PLAN", "CONFIRMED"] },
      },
    });
  } catch {
    overduePayments = 0;
  }

  return NextResponse.json({
    stats: {
      totalUsers,
      totalClients: totalUsers,
      pendingReviews,
      underReview,
      activeReservations,
      activeInstallments,
      expiringReservations,
      pendingPayments,
      overduePayments,
      toolRentals,
      revenue: revenueAgg._sum.amount || 0,
    },
    maintenance,
    recentLogs,
  });
}
