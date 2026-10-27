import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

/** List all reservations for admin */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const reservations = await prisma.reservation.findMany({
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      asset: true,
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reservations);
}

/**
 * Accept or reject a reservation.
 * body: { id, action: "ACCEPT" | "REJECT" }
 *
 * ACCEPT  → status CONFIRMED, asset stays RESERVED (or SOLD if fully paid later)
 * REJECT  → status CANCELLED, asset returns to AVAILABLE, pending payments failed
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const body = await req.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "id and action required" }, { status: 400 });
    }
    if (!["ACCEPT", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "action must be ACCEPT or REJECT" }, { status: 400 });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { asset: true },
    });
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (!["PENDING", "CONFIRMED"].includes(reservation.status) && action === "ACCEPT") {
      // allow accepting only pending (or re-confirm)
      if (reservation.status !== "PENDING") {
        return NextResponse.json(
          { error: `Cannot accept a reservation with status ${reservation.status}` },
          { status: 400 }
        );
      }
    }

    if (action === "ACCEPT") {
      const updated = await prisma.$transaction(async (tx) => {
        const r = await tx.reservation.update({
          where: { id },
          data: { status: "CONFIRMED" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            asset: true,
          },
        });
        // Keep asset reserved / mark sold once confirmed
        await tx.asset.update({
          where: { id: reservation.assetId },
          data: { status: "RESERVED" },
        });
        // Mark related pending payments as completed (admin accepted hold)
        await tx.payment.updateMany({
          where: { reservationId: id, status: "PENDING" },
          data: { status: "COMPLETED", method: "ADMIN_CONFIRMED" },
        });
        return r;
      });
      return NextResponse.json({
        ...updated,
        message: "Reservation accepted",
      });
    }

    // REJECT
    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.reservation.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          asset: true,
        },
      });
      await tx.payment.updateMany({
        where: { reservationId: id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      // Free asset if no other active hold
      const other = await tx.reservation.findFirst({
        where: {
          assetId: reservation.assetId,
          id: { not: id },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });
      if (!other) {
        await tx.asset.update({
          where: { id: reservation.assetId },
          data: { status: "AVAILABLE" },
        });
      }
      return r;
    });

    return NextResponse.json({
      ...updated,
      message: "Reservation rejected — asset returned to available listings",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update reservation" }, { status: 500 });
  }
}
