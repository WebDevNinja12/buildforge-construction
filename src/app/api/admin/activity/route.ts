import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { runMaintenance } from "@/lib/maintenance";

/** Admin overview of all client activity */
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
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.count({ where: { status: "PENDING_APPROVAL", role: "CLIENT" } }),
    prisma.user.groupBy({
      by: ["status"],
      where: { role: "CLIENT" },
      _count: true,
    }),
  ]);

  return NextResponse.json({
    pendingApprovals: pendingUsers,
    statusCounts: counts,
    reservations,
    rentals,
    hires,
    payments,
  });
}
