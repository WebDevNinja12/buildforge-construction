import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Client: list own tool rentals + worker hire requests so they can pay from Dashboard.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role === "ADMIN") {
      return NextResponse.json({ error: "Use admin endpoints" }, { status: 403 });
    }

    const [toolRentals, hireRequests] = await Promise.all([
      prisma.toolRental
        .findMany({
          where: { userId: session.id },
          include: {
            tool: {
              select: {
                id: true,
                name: true,
                category: true,
                dailyRate: true,
                weeklyRate: true,
                image: true,
              },
            },
            payments: { orderBy: { createdAt: "desc" }, take: 5 },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
        .catch(() => []),
      prisma.hireRequest
        .findMany({
          where: { userId: session.id },
          include: {
            worker: {
              select: {
                id: true,
                name: true,
                specialty: true,
                dailyRate: true,
                image: true,
                location: true,
              },
            },
            payments: { orderBy: { createdAt: "desc" }, take: 5 },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
        .catch(() => []),
    ]);

    return NextResponse.json({
      toolRentals,
      hireRequests,
    });
  } catch (e) {
    console.error("client bookings GET", e);
    return NextResponse.json(
      { error: "Failed to load bookings", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
