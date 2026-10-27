import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireApproved } from "@/lib/auth";
import { RESERVATION_PAYMENT_HOURS, runMaintenance } from "@/lib/maintenance";

export async function GET() {
  try {
    await runMaintenance();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const where =
      session.role === "ADMIN" ? {} : { userId: session.id };

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        asset: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await runMaintenance();
    let session;
    try {
      session = await requireApproved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      return NextResponse.json(
        { error: msg === "Account pending approval" ? msg : "Please login to reserve" },
        { status: msg === "Account pending approval" ? 403 : 401 }
      );
    }

    const body = await req.json();
    const { assetId, notes, deposit, confirmed } = body;

    if (!assetId) {
      return NextResponse.json({ error: "Asset ID required" }, { status: 400 });
    }
    if (!confirmed) {
      return NextResponse.json(
        { error: "Please confirm the booking details before reserving" },
        { status: 400 }
      );
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== "AVAILABLE") {
      return NextResponse.json(
        { error: "Asset not available" },
        { status: 400 }
      );
    }

    const depositAmount = deposit ?? asset.price * 0.1;
    const expiresAt = new Date(
      Date.now() + RESERVATION_PAYMENT_HOURS * 60 * 60 * 1000
    );

    const reservation = await prisma.$transaction(async (tx) => {
      // Remove from available listings immediately
      await tx.asset.update({
        where: { id: assetId },
        data: { status: "RESERVED" },
      });

      return tx.reservation.create({
        data: {
          userId: session.id,
          assetId,
          deposit: depositAmount,
          notes: notes || null,
          status: "PENDING",
          expiresAt,
        },
        include: { asset: true },
      });
    });

    await prisma.payment.create({
      data: {
        userId: session.id,
        amount: depositAmount,
        type: "RESERVATION",
        method: "PENDING",
        status: "PENDING",
        reservationId: reservation.id,
        referenceId: reservation.id,
      },
    });

    return NextResponse.json(
      {
        ...reservation,
        message: `Reservation held for ${RESERVATION_PAYMENT_HOURS} hours. Pay the deposit before then or it will be released automatically.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Reservation failed" }, { status: 500 });
  }
}
