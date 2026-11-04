import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Client: list own payments. Admin: list all (or filter). */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const status = new URL(req.url).searchParams.get("status");
    const where =
      session.role === "ADMIN"
        ? status
          ? { status }
          : {}
        : status
          ? { userId: session.id, status }
          : { userId: session.id };

    const payments = await prisma.payment.findMany({
      where,
      include: {
        reservation: { include: { asset: { select: { id: true, title: true, type: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(payments);
  } catch (e) {
    console.error("payments GET", e);
    return NextResponse.json(
      { error: "Failed to load payments", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/**
 * Client submits a payment against a reservation (or tool/hire).
 * Prefer /api/plans/[id] with action PAY_* for reservation plans.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const reservationId = body.reservationId ? String(body.reservationId) : null;
    const toolRentalId = body.toolRentalId ? String(body.toolRentalId) : null;
    const hireRequestId = body.hireRequestId ? String(body.hireRequestId) : null;
    const type = String(body.type || "FULL");
    const proofUrl = body.proofUrl ? String(body.proofUrl) : null;

    if (!(amount > 0) || !Number.isFinite(amount)) {
      return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    }
    if (!reservationId && !toolRentalId && !hireRequestId) {
      return NextResponse.json(
        { error: "reservationId, toolRentalId, or hireRequestId required" },
        { status: 400 }
      );
    }

    if (reservationId) {
      const resv = await prisma.reservation.findUnique({ where: { id: reservationId } });
      if (!resv) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
      if (session.role !== "ADMIN" && resv.userId !== session.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (["CANCELLED", "EXPIRED"].includes(resv.status)) {
        return NextResponse.json({ error: "Reservation is not active" }, { status: 400 });
      }
    }

    const payment = await prisma.payment.create({
      data: {
        userId: session.id,
        amount,
        currency: String(body.currency || "USD"),
        type,
        method: proofUrl ? "PROOF_UPLOAD" : "MANUAL",
        status: "PENDING",
        proofUrl,
        reservationId,
        toolRentalId,
        hireRequestId,
        referenceId: reservationId || toolRentalId || hireRequestId,
      },
    });

    try {
      await prisma.notification.create({
        data: {
          userId: session.id,
          title: "Payment submitted",
          body: `Payment of ${amount} is pending admin approval.`,
          type: "PAYMENT",
        },
      });
    } catch {
      /* */
    }

    return NextResponse.json(
      { ok: true, payment, message: "Payment submitted for admin approval" },
      { status: 201 }
    );
  } catch (e) {
    console.error("payments POST", e);
    return NextResponse.json(
      { error: "Payment failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
