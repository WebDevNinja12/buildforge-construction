import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reservations = await prisma.reservation.findMany({
      where: { userId: session.id },
      include: { asset: true },
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Please login to reserve" }, { status: 401 });
    }

    const body = await req.json();
    const { assetId, notes, deposit } = body;

    if (!assetId) {
      return NextResponse.json({ error: "Asset ID required" }, { status: 400 });
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== "AVAILABLE") {
      return NextResponse.json(
        { error: "Asset not available" },
        { status: 400 }
      );
    }

    const depositAmount = deposit ?? asset.price * 0.1;

    const reservation = await prisma.$transaction(async (tx) => {
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

    return NextResponse.json(reservation, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Reservation failed" }, { status: 500 });
  }
}
