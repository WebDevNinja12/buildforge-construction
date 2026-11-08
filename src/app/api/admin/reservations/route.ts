import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/admin-activity";
import { healSchema } from "@/lib/schema-heal";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

function normalizeAction(body: Record<string, unknown>): "ACCEPT" | "REJECT" | null {
  const raw = String(body.action || body.status || "")
    .trim()
    .toUpperCase();
  if (["ACCEPT", "APPROVE", "APPROVED", "CONFIRM"].includes(raw)) return "ACCEPT";
  if (["REJECT", "REJECTED", "CANCEL"].includes(raw)) return "REJECT";
  return null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  await healSchema().catch(() => null);
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        asset: true,
        user: { select: { id: true, name: true, email: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 10 },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json(reservations);
  } catch (e) {
    try {
      const reservations = await prisma.reservation.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(reservations);
    } catch (e2) {
      return NextResponse.json(
        { error: "Failed to load", detail: e2 instanceof Error ? e2.message : String(e2) },
        { status: 500 }
      );
    }
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    await healSchema().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    const action = normalizeAction(body);

    if (!id || !action) {
      return NextResponse.json(
        {
          error: "id and action required",
          hint: 'action: ACCEPT|REJECT|CANCEL (or status APPROVED|REJECTED)',
        },
        { status: 400 }
      );
    }

    const reservation = await prisma.reservation.findUnique({ where: { id } });
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (action === "ACCEPT") {
      if (!["PENDING", "CONFIRMED"].includes(reservation.status)) {
        return NextResponse.json(
          { error: `Cannot accept a reservation with status ${reservation.status}` },
          { status: 400 }
        );
      }

      await prisma.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
      });
      await prisma.$executeRaw`
        UPDATE "Asset" SET status = 'RESERVED', "updatedAt" = ${new Date()}
        WHERE id = ${reservation.assetId}
      `.catch(() => null);

      const user = await prisma.user.findUnique({
        where: { id: reservation.userId },
        select: { email: true, name: true },
      });

      await prisma.notification
        .create({
          data: {
            userId: reservation.userId,
            title: "Reservation accepted",
            body: "Your reservation was accepted by Hama Construction.",
            type: "RESERVATION",
          },
        })
        .catch(() => null);

      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "RESERVATION_ACCEPT",
        entity: "Reservation",
        entityId: id,
        details: { assetId: reservation.assetId },
        alsoNotifyEmails: user?.email ? [user.email] : [],
      });

      return NextResponse.json({ ok: true, message: "Reservation accepted", status: "CONFIRMED" });
    }

    if (!["PENDING", "CONFIRMED"].includes(reservation.status)) {
      return NextResponse.json(
        { error: `Cannot cancel a reservation with status ${reservation.status}` },
        { status: 400 }
      );
    }

    const cancelReason = body.reason
      ? String(body.reason).slice(0, 500)
      : "Cancelled by admin";

    await prisma.reservation.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason,
      },
    });
    await prisma.payment.updateMany({
      where: { reservationId: id, status: "PENDING" },
      data: { status: "FAILED" },
    });

    const other = await prisma.reservation.findFirst({
      where: {
        assetId: reservation.assetId,
        id: { not: id },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });
    if (!other) {
      await prisma.$executeRaw`
        UPDATE "Asset" SET status = 'AVAILABLE', "updatedAt" = ${new Date()}
        WHERE id = ${reservation.assetId}
      `.catch(() => null);
    }

    const user = await prisma.user.findUnique({
      where: { id: reservation.userId },
      select: { email: true },
    });

    await prisma.notification
      .create({
        data: {
          userId: reservation.userId,
          title: "Plan cancelled",
          body: `Your plan was cancelled by admin. ${cancelReason}`,
          type: "RESERVATION",
          link: "/dashboard#plans",
        },
      })
      .catch(() => null);

    await recordAdminActivity({
      adminId: admin.id,
      adminEmail: admin.email,
      adminName: admin.name,
      action: "RESERVATION_CANCEL",
      entity: "Reservation",
      entityId: id,
      details: { assetId: reservation.assetId, reason: cancelReason },
      alsoNotifyEmails: user?.email ? [user.email] : [],
    });

    return NextResponse.json({
      ok: true,
      message: "Plan cancelled — asset returned to available listings if free",
      status: "CANCELLED",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update reservation", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
