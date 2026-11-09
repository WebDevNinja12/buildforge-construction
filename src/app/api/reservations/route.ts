import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getExpiryHours } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

async function loadAsset(id: string) {
  try {
    return await prisma.asset.findUnique({ where: { id } });
  } catch {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string;
        type: string;
        price: number;
        location: string | null;
        status: string;
        active: boolean | null;
        reservationHours: number | null;
      }>
    >`SELECT id, title, description, type, price, location, status, active, "reservationHours"
      FROM "Asset" WHERE id = ${id} LIMIT 1`;
    return rows[0] || null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (session.role === "ADMIN") {
      const list = await prisma.reservation.findMany({
        include: {
          asset: true,
          user: { select: { id: true, name: true, email: true } },
          payments: { orderBy: { createdAt: "desc" }, take: 20 },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(list);
    }

    const list = await prisma.reservation.findMany({
      where: { userId: session.id },
      include: {
        asset: true,
        payments: { orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(list);
  } catch (e) {
    console.error("reservations GET", e);
    return NextResponse.json({ error: "Failed to load reservations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Please login to reserve" }, { status: 401 });

    const status = (session.status || "").toUpperCase();
    if (["REJECTED", "SUSPENDED", "ARCHIVED"].includes(status)) {
      return NextResponse.json(
        { error: "Your account cannot make reservations. Contact support." },
        { status: 403 }
      );
    }
    if (status === "PENDING_APPROVAL" || status === "PENDING") {
      return NextResponse.json(
        {
          error:
            "Account pending approval. Wait for admin approval or auto-approval (within 12 hours).",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const assetId = String(body.assetId || body.id || "").trim();
    const confirmed = body.confirmed === true || body.confirmed === "true";
    let notes = body.notes ? String(body.notes).slice(0, 500) : null;
    const checkInRaw = body.checkIn ? String(body.checkIn).slice(0, 32) : "";
    const checkOutRaw = body.checkOut ? String(body.checkOut).slice(0, 32) : "";
    const nightsBody = Number(body.nights || body.stayNights || 0);

    if (!assetId) {
      return NextResponse.json({ error: "Asset ID required" }, { status: 400 });
    }
    if (!confirmed) {
      return NextResponse.json(
        { error: "Please confirm after reviewing details" },
        { status: 400 }
      );
    }

    const asset = await loadAsset(assetId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (asset.active === false) {
      return NextResponse.json({ error: "Asset is inactive" }, { status: 400 });
    }
    if (String(asset.status).toUpperCase() !== "AVAILABLE") {
      return NextResponse.json(
        {
          error: `This service is not available right now (status: ${asset.status}). Try another listing or wait for an expired hold to release.`,
        },
        { status: 400 }
      );
    }

    const assetType = String(asset.type || "").toUpperCase();
    const nightlyRate = Number(asset.price) || 0;
    let stayNights = 0;
    let checkIn: Date | null = null;
    let checkOut: Date | null = null;
    let stayTotal = nightlyRate;

    if (assetType === "HOTEL") {
      if (checkInRaw && checkOutRaw) {
        checkIn = new Date(checkInRaw);
        checkOut = new Date(checkOutRaw);
        if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
          return NextResponse.json({ error: "Invalid check-in or check-out date" }, { status: 400 });
        }
        if (checkOut <= checkIn) {
          return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
        }
        stayNights = Math.max(
          1,
          Math.ceil((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000))
        );
      } else if (nightsBody >= 1) {
        stayNights = Math.floor(nightsBody);
        checkIn = new Date();
        checkIn.setHours(14, 0, 0, 0);
        checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + stayNights);
      } else {
        // Default 1 night when UI omitted dates (still calculate fee)
        stayNights = 1;
        checkIn = new Date();
        checkIn.setHours(14, 0, 0, 0);
        checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + stayNights);
      }
      stayTotal = Math.round(nightlyRate * stayNights * 100) / 100;
      const stayNote = `HOTEL_STAY nights=${stayNights} checkIn=${checkIn!.toISOString().slice(0, 10)} checkOut=${checkOut!.toISOString().slice(0, 10)} nightly=${nightlyRate}`;
      notes = notes ? `${stayNote} | ${notes}`.slice(0, 500) : stayNote;
    }

    let hours = 48;
    try {
      hours = await getExpiryHours(asset.type, asset.reservationHours);
    } catch {
      hours = asset.reservationHours || 48;
    }
    if (!Number.isFinite(hours) || hours <= 0) hours = 48;

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const resId =
      "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    const now = new Date();

    try {
      await prisma.$executeRaw`
        UPDATE "Asset" SET status = 'RESERVED', "updatedAt" = ${now}
        WHERE id = ${asset.id} AND status = 'AVAILABLE'
      `;
      const updated = await prisma.$queryRaw<{ status: string }[]>`
        SELECT status FROM "Asset" WHERE id = ${asset.id} LIMIT 1
      `;
      if (!updated[0] || updated[0].status !== "RESERVED") {
        return NextResponse.json({ error: "Asset not available" }, { status: 400 });
      }

      await prisma.$executeRaw`
        INSERT INTO "Reservation" (
          id, "userId", "assetId", status, "paymentType", "expiresAt",
          "installmentTotal", "installmentPaid", "docsStatus", "cancelReason",
          "createdAt", "updatedAt"
        ) VALUES (
          ${resId}, ${session.id}, ${asset.id}, 'PENDING', NULL, ${expiresAt},
          ${stayTotal}, 0, 'INCOMPLETE', ${notes},
          ${now}, ${now}
        )
      `;
    } catch (e) {
      await prisma.$executeRaw`
        UPDATE "Asset" SET status = 'AVAILABLE', "updatedAt" = ${now}
        WHERE id = ${asset.id} AND status = 'RESERVED'
      `.catch(() => null);
      throw e;
    }

    try {
      await prisma.notification.create({
        data: {
          userId: session.id,
          title: "Reservation created",
          body:
            assetType === "HOTEL"
              ? `"${asset.title}" held for ${hours}h. Stay ${stayNights} night(s) — total ${stayTotal}. Pay from Dashboard.`
              : `"${asset.title}" is held for ${hours} hours. Open Dashboard to choose payment before the hold expires.`,
          type: "RESERVATION",
        },
      });
    } catch {
      /* optional */
    }

    return NextResponse.json(
      {
        id: resId,
        userId: session.id,
        assetId: asset.id,
        status: "PENDING",
        expiresAt,
        installmentTotal: stayTotal,
        installmentPaid: 0,
        stay:
          assetType === "HOTEL"
            ? {
                nights: stayNights,
                checkIn: checkIn?.toISOString() || null,
                checkOut: checkOut?.toISOString() || null,
                nightlyRate,
                total: stayTotal,
              }
            : null,
        asset: {
          id: asset.id,
          title: asset.title,
          type: asset.type,
          price: asset.price,
          location: asset.location,
          status: "RESERVED",
        },
        message:
          assetType === "HOTEL"
            ? `Hotel held for ${hours}h. Stay ${stayNights} night(s) — total ${stayTotal}. Pay from Dashboard.`
            : `Reserved for ${hours} hours. Go to Dashboard to choose payment and complete payment.`,
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
