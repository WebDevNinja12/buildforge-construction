import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

function parseSchedule(json: string | null | undefined) {
  if (!json) return [] as Array<{ sequence: number; amount: number; dueDate: string; status?: string }>;
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Apply approved payment amount onto the reservation plan */
async function applyPaymentToReservation(paymentId: string, amount: number, reservationId: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation) return;

  const total = Number(reservation.installmentTotal ?? 0);
  const prevPaid = Number(reservation.installmentPaid ?? 0);
  const newPaid = prevPaid + amount;
  const fullyPaid = total > 0 ? newPaid >= total - 0.01 : newPaid > 0;

  let scheduleJson = reservation.scheduleJson;
  let nextDueAt = reservation.nextDueAt;

  if (reservation.paymentType === "INSTALLMENT" && reservation.scheduleJson) {
    const schedule = parseSchedule(reservation.scheduleJson);
    let remaining = amount;
    for (const row of schedule) {
      if ((row.status || "PENDING") !== "PENDING") continue;
      if (remaining <= 0) break;
      const due = Number(row.amount) || 0;
      if (remaining + 0.01 >= due) {
        row.status = "PAID";
        remaining -= due;
      } else {
        // partial — leave pending but reduce conceptual amount (keep simple: mark paid if close)
        break;
      }
    }
    const next = schedule.find((i) => (i.status || "PENDING") === "PENDING");
    nextDueAt = next?.dueDate ? new Date(next.dueDate) : null;
    scheduleJson = JSON.stringify(schedule);
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      installmentPaid: newPaid,
      scheduleJson,
      nextDueAt,
      paidAt: fullyPaid ? new Date() : reservation.paidAt,
      status: fullyPaid ? "CONFIRMED" : reservation.status === "PENDING" ? "CONFIRMED" : reservation.status,
    },
  });

  // Keep asset reserved while plan active; mark SOLD when fully paid for property types
  if (fullyPaid && reservation.assetId) {
    await prisma.asset
      .update({
        where: { id: reservation.assetId },
        data: { status: "SOLD" },
      })
      .catch(() => null);
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const status = new URL(req.url).searchParams.get("status");
  try {
    const payments = await prisma.payment.findMany({
      where: status ? { status } : undefined,
      include: {
        user: { select: { id: true, name: true, email: true } },
        reservation: { include: { asset: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 150,
    });
    return NextResponse.json(payments);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load payments" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const body = await req.json();
    const id = String(body.id || "");
    const action = String(body.action || "").toUpperCase();
    const reason = body.reason ? String(body.reason) : null;

    if (!id || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json(
        { error: "id and action (APPROVE|REJECT) required" },
        { status: 400 }
      );
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        reservation: true,
      },
    });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    if (payment.status === "APPROVED" && action === "APPROVE") {
      return NextResponse.json({ ok: true, message: "Already approved" });
    }

    if (action === "APPROVE") {
      await prisma.payment.update({
        where: { id },
        data: {
          status: "APPROVED",
          method: payment.method || "ADMIN",
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          rejectReason: null,
        },
      });

      if (payment.reservationId) {
        await applyPaymentToReservation(id, payment.amount, payment.reservationId);
      }

      if (payment.userId) {
        await prisma.notification
          .create({
            data: {
              userId: payment.userId,
              title: "Payment approved",
              body: `Your payment of ${payment.amount} was approved.`,
              type: "PAYMENT",
            },
          })
          .catch(() => null);
      }
    } else {
      await prisma.payment.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectReason: reason,
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        },
      });
      if (payment.userId) {
        await prisma.notification
          .create({
            data: {
              userId: payment.userId,
              title: "Payment rejected",
              body: reason || "Your payment was rejected. Contact support.",
              type: "PAYMENT",
            },
          })
          .catch(() => null);
      }
    }

    await recordAdminActivity({
      adminId: admin.id,
      adminEmail: admin.email,
      adminName: admin.name,
      action: action === "APPROVE" ? "PAYMENT_APPROVE" : "PAYMENT_REJECT",
      entity: "Payment",
      entityId: id,
      details: {
        amount: payment.amount,
        reason,
        client: payment.user?.email,
        reservationId: payment.reservationId,
      },
      alsoNotifyEmails: payment.user?.email ? [payment.user.email] : [],
    });

    return NextResponse.json({ ok: true, action });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Update failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
