import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireApproved } from "@/lib/auth";
import { getExpiryHours, runMaintenance } from "@/lib/maintenance";

export async function GET() {
  try {
    await runMaintenance();
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const where = session.role === "ADMIN" ? {} : { userId: session.id };

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        asset: true,
        user: { select: { id: true, name: true, email: true } },
        installments: { orderBy: { sequence: "asc" } },
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
    const { assetId, notes, deposit, confirmed, payInFull } = body;

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
    if (!asset || asset.status !== "AVAILABLE" || asset.active === false) {
      return NextResponse.json({ error: "Asset not available" }, { status: 400 });
    }

    const hours = await getExpiryHours(asset.type, asset.reservationHours);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const depositAmount = deposit ?? asset.price * 0.1;
    const totalAmount = asset.price;

    const reservation = await prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id: assetId },
        data: { status: "RESERVED" },
      });

      const res = await tx.reservation.create({
        data: {
          userId: session.id,
          assetId,
          deposit: depositAmount,
          totalAmount,
          amountPaid: 0,
          notes: notes || null,
          status: "PENDING",
          expiresAt,
        },
        include: { asset: true },
      });

      // Optional installment schedule
      if (asset.installmentCount && asset.installmentCount > 1) {
        let percents: number[] = [];
        try {
          percents = JSON.parse(asset.installmentPercents || "[]");
        } catch {
          percents = [];
        }
        if (percents.length !== asset.installmentCount) {
          percents = Array(asset.installmentCount).fill(100 / asset.installmentCount);
        }
        for (let i = 0; i < asset.installmentCount; i++) {
          const amount = Math.round((totalAmount * (percents[i] / 100)) * 100) / 100;
          const due = new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000);
          await tx.installment.create({
            data: {
              reservationId: res.id,
              sequence: i + 1,
              amount,
              dueDate: due,
              status: "PENDING",
            },
          });
        }
      }

      return res;
    });

    const firstAmount = payInFull ? totalAmount : depositAmount;
    await prisma.payment.create({
      data: {
        userId: session.id,
        amount: firstAmount,
        type: payInFull ? "FULL" : "DEPOSIT",
        method: "PENDING",
        status: "PENDING",
        reservationId: reservation.id,
        referenceId: reservation.id,
      },
    });

    await prisma.notification.create({
      data: {
        userId: session.id,
        title: "Reservation created",
        body: `Hold on "${asset.title}" for ${hours} hours. Complete payment before expiry or it will be released.`,
        type: "RESERVATION",
        link: "/dashboard",
      },
    });

    return NextResponse.json(
      {
        ...reservation,
        message: `Reservation held for ${hours} hours. Pay before then or it will be released automatically.`,
        expiryHours: hours,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Reservation failed" }, { status: 500 });
  }
}
