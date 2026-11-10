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

function parseSchedule(json: string | null | undefined) {
  if (!json) return [] as Array<{ sequence: number; amount: number; dueDate: string; status?: string }>;
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function normalizeAction(body: Record<string, unknown>): "APPROVE" | "REJECT" | null {
  const raw = String(body.action || body.status || "")
    .trim()
    .toUpperCase();
  if (["APPROVE", "APPROVED", "ACCEPT"].includes(raw)) return "APPROVE";
  if (["REJECT", "REJECTED"].includes(raw)) return "REJECT";
  return null;
}

async function applyPaymentToReservation(amount: number, reservationId: string) {
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation) return null;

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
      } else break;
    }
    const next = schedule.find((i) => (i.status || "PENDING") === "PENDING");
    nextDueAt = next?.dueDate ? new Date(next.dueDate) : null;
    scheduleJson = JSON.stringify(schedule);
  }

  const nextStatus = fullyPaid
    ? "FULLY_PAID"
    : reservation.status === "PENDING"
      ? "CONFIRMED"
      : reservation.status;

  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      installmentPaid: newPaid,
      scheduleJson,
      nextDueAt,
      paidAt: fullyPaid ? new Date() : reservation.paidAt,
      status: nextStatus,
    },
  });

  if (fullyPaid && reservation.assetId) {
    await prisma.$executeRaw`
      UPDATE "Asset" SET status = 'SOLD', "updatedAt" = ${new Date()}
      WHERE id = ${reservation.assetId}
    `.catch(() => null);
  }

  return {
    installmentPaid: newPaid,
    installmentTotal: total,
    balance: Math.max(0, total - newPaid),
    fullyPaid,
    status: nextStatus,
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  await healSchema().catch(() => null);
  const status = new URL(req.url).searchParams.get("status");
  try {
    const payments = await prisma.payment.findMany({
      where: status && status !== "ALL" ? { status } : undefined,
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
    try {
      const payments = await prisma.payment.findMany({
        where: status && status !== "ALL" ? { status } : undefined,
        orderBy: { createdAt: "desc" },
        take: 150,
      });
      return NextResponse.json(payments);
    } catch (e2) {
      return NextResponse.json(
        { error: "Failed to load payments", detail: e2 instanceof Error ? e2.message : String(e2) },
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
    const reason =
      body.reason != null
        ? String(body.reason)
        : body.rejectReason != null
          ? String(body.rejectReason)
          : null;

    if (!id || !action) {
      return NextResponse.json(
        {
          error: "id and action/status required",
          hint: 'Send { id, action: "APPROVE"|"REJECT" } or { id, status: "APPROVED"|"REJECTED" }',
        },
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

      let balanceNote = "";
      if (payment.reservationId) {
        const result = await applyPaymentToReservation(payment.amount, payment.reservationId);
        if (result) {
          balanceNote = result.fullyPaid
            ? ` Plan fully paid (₦${Number(result.installmentPaid).toLocaleString("en-NG")}). Service completed.`
            : ` Paid so far ₦${Number(result.installmentPaid).toLocaleString("en-NG")}; remaining balance ₦${Number(result.balance).toLocaleString("en-NG")}.`;
        }
      }

      if (payment.toolRentalId) {
        const rental = await prisma.toolRental.findUnique({ where: { id: payment.toolRentalId } });
        const total = Number(rental?.total || 0);
        const approvedSum = await prisma.payment
          .aggregate({
            where: { toolRentalId: payment.toolRentalId, status: "APPROVED" },
            _sum: { amount: true },
          })
          .catch(() => ({ _sum: { amount: 0 } }));
        const paid = Number(approvedSum._sum.amount || 0);
        const done = total > 0 && paid >= total - 0.01;
        await prisma.toolRental
          .update({
            where: { id: payment.toolRentalId },
            data: {
              status: done ? "COMPLETED" : "CONFIRMED",
              expiresAt: done ? null : rental?.expiresAt,
            },
          })
          .catch(() => null);
        if (done) balanceNote = " Tool hire fully paid and completed.";
      }
      if (payment.hireRequestId) {
        const hire = await prisma.hireRequest.findUnique({ where: { id: payment.hireRequestId } });
        const total = Number(hire?.total || 0);
        const approvedSum = await prisma.payment
          .aggregate({
            where: { hireRequestId: payment.hireRequestId, status: "APPROVED" },
            _sum: { amount: true },
          })
          .catch(() => ({ _sum: { amount: 0 } }));
        const paid = Number(approvedSum._sum.amount || 0);
        const done = total > 0 && paid >= total - 0.01;
        await prisma.hireRequest
          .update({
            where: { id: payment.hireRequestId },
            data: {
              status: done ? "COMPLETED" : "CONFIRMED",
              expiresAt: done ? null : hire?.expiresAt,
            },
          })
          .catch(() => null);
        if (done) balanceNote = " Worker hire fully paid and completed.";
      }

      if (payment.userId) {
        await prisma.notification
          .create({
            data: {
              userId: payment.userId,
              title: "Payment approved",
              body: `Your payment of ₦${Number(payment.amount).toLocaleString("en-NG")} was approved.${balanceNote}`,
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
        toolRentalId: payment.toolRentalId,
        hireRequestId: payment.hireRequestId,
      },
      alsoNotifyEmails: payment.user?.email ? [payment.user.email] : [],
    });

    return NextResponse.json({
      ok: true,
      action,
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Update failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
