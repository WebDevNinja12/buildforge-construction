import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getExpiryHours } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
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
    return NextResponse.json(
      { error: "Failed to fetch", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Please login to reserve" }, { status: 401 });
    }

    const status = (session.status || "").toUpperCase();
    if (["REJECTED", "SUSPENDED", "ARCHIVED"].includes(status)) {
      return NextResponse.json(
        { error: "Your account cannot make reservations. Contact support." },
        { status: 403 }
      );
    }
    if (status === "PENDING_APPROVAL" || status === "PENDING") {
      return NextResponse.json(
        { error: "Account pending approval. Wait for admin approval or auto-approval." },
        { status: 403 }
      );
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

    const asset = await prisma.asset.findUnique({ where: { id: String(assetId) } });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (asset.active === false) {
      return NextResponse.json({ error: "Asset is inactive" }, { status: 400 });
    }
    if (asset.status !== "AVAILABLE") {
      return NextResponse.json(
        { error: `Asset is not available (status: ${asset.status})` },
        { status: 400 }
      );
    }

    let hours = 48;
    try {
      hours = await getExpiryHours(asset.type, asset.reservationHours);
    } catch {
      const defaults: Record<string, number> = {
        HOUSE: 336,
        BUILDING: 336,
        HOTEL: 168,
        LAND: 120,
        APARTMENT: 168,
        COMMERCIAL: 168,
      };
      hours = asset.reservationHours || defaults[asset.type] || 48;
    }

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const reservation = await prisma.$transaction(async (tx) => {
      const current = await tx.asset.findUnique({ where: { id: asset.id } });
      if (!current || current.status !== "AVAILABLE" || current.active === false) {
        throw new Error("Asset not available");
      }

      const res = await tx.reservation.create({
        data: {
          userId: session.id,
          assetId: asset.id,
          status: "PENDING",
          paymentType: null,
          expiresAt,
          installmentTotal: asset.price,
          installmentPaid: 0,
          cancelReason: notes ? String(notes).slice(0, 500) : null,
        },
        include: { asset: true },
      });

      await tx.asset.update({
        where: { id: asset.id },
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
      /* optional */
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
    return NextResponse.json({ error: "Reservation failed", detail: msg }, { status: 500 });
  }
}
