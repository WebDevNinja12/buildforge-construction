import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireApproved } from "@/lib/auth";
import { getExpiryHours, runMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await runMaintenance().catch(() => null);
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const where = session.role === "ADMIN" ? {} : { userId: session.id };
    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        asset: true,
        user: { select: { id: true, name: true, email: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(reservations);
  } catch (error) {
    console.error("reservations GET", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

/**
 * Reserve first — payment method chosen later on the dashboard.
 * Fields match prisma Reservation model only.
 */
export async function POST(req: NextRequest) {
  try {
    await runMaintenance().catch(() => null);

    let session;
    try {
      session = await requireApproved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      if (msg === "Account pending approval" || msg.toLowerCase().includes("pending")) {
        return NextResponse.json({ error: "Account pending approval" }, { status: 403 });
      }
      return NextResponse.json({ error: "Please login to reserve" }, { status: 401 });
    }

    const body = await req.json();
    const { assetId, confirmed, notes } = body;

    if (!assetId) {
      return NextResponse.json({ error: "Asset ID required" }, { status: 400 });
    }
    if (!confirmed) {
      return NextResponse.json(
        { error: "Please confirm after reviewing details" },
        { status: 400 }
      );
    }

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || asset.status !== "AVAILABLE" || asset.active === false) {
      return NextResponse.json({ error: "Asset not available" }, { status: 400 });
    }

    // Default hold period by type (hours); asset.reservationHours overrides
    let hours = 48;
    try {
      hours = await getExpiryHours(asset.type);
    } catch {
      const defaults: Record<string, number> = {
        HOUSE: 14 * 24,
        BUILDING: 14 * 24,
        HOTEL: 7 * 24,
        LAND: 5 * 24,
        APARTMENT: 7 * 24,
        COMMERCIAL: 7 * 24,
      };
      hours = defaults[asset.type] || 48;
    }
    if (asset.reservationHours && asset.reservationHours > 0) {
      hours = asset.reservationHours;
    }

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const reservation = await prisma.$transaction(async (tx) => {
      // Re-check availability inside transaction
      const current = await tx.asset.findUnique({ where: { id: assetId } });
      if (!current || current.status !== "AVAILABLE" || current.active === false) {
        throw new Error("Asset not available");
      }

      const res = await tx.reservation.create({
        data: {
          userId: session.id,
          assetId,
          status: "PENDING",
          paymentType: null, // chosen on dashboard: FULL | INSTALLMENT
          expiresAt,
          installmentTotal: asset.price,
          installmentPaid: 0,
          cancelReason: notes ? String(notes).slice(0, 500) : null,
        },
        include: { asset: true },
      });

      await tx.asset.update({
        where: { id: assetId },
        data: { status: "RESERVED" },
      });

      return res;
    });

    try {
      await prisma.notification.create({
        data: {
          userId: session.id,
          title: "Reservation created",
          body: `"${asset.title}" is reserved for ${hours} hours. Open Dashboard to choose payment before the hold expires.`,
          type: "RESERVATION",
          link: "/dashboard",
        },
      });
    } catch {
      /* non-fatal */
    }

    return NextResponse.json(
      {
        ...reservation,
        message: `Reserved for ${hours} hours. Go to Dashboard to choose payment and complete payment.`,
        expiryHours: hours,
        nextStep: "/dashboard",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("reservations POST", error);
    const msg = error instanceof Error ? error.message : "Reservation failed";
    if (msg === "Asset not available") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Reservation failed", detail: msg },
      { status: 500 }
    );
  }
}
