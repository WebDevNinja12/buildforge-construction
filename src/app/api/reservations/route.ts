import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, verifyToken, SESSION_COOKIE } from "@/lib/auth";
import { getExpiryHours, runMaintenance } from "@/lib/maintenance";
import { healSchema } from "@/lib/schema-heal";

export const dynamic = "force-dynamic";

type AssetRow = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  price: number;
  location: string | null;
  status: string;
  active: boolean | null;
  reservationHours: number | null;
};

async function resolveSession(req: NextRequest) {
  const fromCookie = await getSession();
  if (fromCookie) return fromCookie;

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const cookieHeader = req.headers.get("cookie") || "";
  const match =
    cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`)) ||
    cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  const rawCookie = match?.[1] ? decodeURIComponent(match[1]) : "";
  const token = bearer || rawCookie;
  if (!token) return null;

  const claims = await verifyToken(token);
  if (!claims?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      deletedAt: true,
    },
  });
  if (!user || user.deletedAt) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}

async function loadAsset(id: string): Promise<AssetRow | null> {
  try {
    const rows = await prisma.$queryRaw<AssetRow[]>`
      SELECT id, title, description, type, price, location, status,
             COALESCE(active, true) AS active,
             "reservationHours"
      FROM "Asset" WHERE id = ${id} LIMIT 1
    `;
    return rows[0] || null;
  } catch {
    try {
      const rows = await prisma.$queryRaw<AssetRow[]>`
        SELECT id, title, description, type, price, location, status
        FROM "Asset" WHERE id = ${id} LIMIT 1
      `;
      if (!rows[0]) return null;
      return { ...rows[0], active: true, reservationHours: null };
    } catch {
      return null;
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    await healSchema().catch(() => null);
    await runMaintenance().catch(() => null);
    const session = await resolveSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const where = session.role === "ADMIN" ? {} : { userId: session.id };
    try {
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
    } catch {
      // Fallback without nested asset if columns still mismatch
      const reservations = await prisma.reservation.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(reservations);
    }
  } catch (error) {
    console.error("reservations GET", error);
    return NextResponse.json(
      {
        error: "Failed to fetch",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Critical: add Asset.image etc. before any Prisma Asset read
    await healSchema().catch(() => null);
    await runMaintenance().catch(() => null);

    const session = await resolveSession(req);
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
    const notes = body.notes ? String(body.notes).slice(0, 500) : null;

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

    let hours = 48;
    try {
      hours = await getExpiryHours(asset.type, asset.reservationHours);
    } catch {
      hours = asset.reservationHours || 48;
    }
    if (!Number.isFinite(hours) || hours <= 0) hours = 48;

    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const resId =
      "c" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 10);
    const now = new Date();

    // Transaction via raw SQL so missing optional columns never block create
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
          ${Number(asset.price)}, 0, 'INCOMPLETE', ${notes},
          ${now}, ${now}
        )
      `;
    } catch (e) {
      // Rollback asset if insert failed
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
          body: `"${asset.title}" is held for ${hours} hours. Open Dashboard to choose payment before the hold expires.`,
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
        installmentTotal: Number(asset.price),
        installmentPaid: 0,
        asset: {
          id: asset.id,
          title: asset.title,
          type: asset.type,
          price: asset.price,
          location: asset.location,
          status: "RESERVED",
        },
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
