import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

async function log(adminId: string, action: string, entity?: string, entityId?: string, details?: string) {
  try {
    await prisma.adminActivityLog.create({
      data: { adminId, action, entity, entityId, details },
    });
  } catch {
    /* ignore if table missing mid-migrate */
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const status = new URL(req.url).searchParams.get("status");
  const payments = await prisma.payment.findMany({
    where: status ? { status } : undefined,
    include: {
      user: { select: { id: true, name: true, email: true } },
      reservation: { include: { asset: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(payments);
}

/** Approve or reject a payment
 * body: { id, action: "APPROVE" | "REJECT", reason?: string }
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const { id, action, reason } = await req.json();
    if (!id || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "id and action (APPROVE|REJECT) required" }, { status: 400 });
    }
    if (action === "REJECT" && !reason?.trim()) {
      return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { reservation: true },
    });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    if (payment.status !== "PENDING") {
      return NextResponse.json({ error: `Payment already ${payment.status}` }, { status: 400 });
    }

    if (action === "REJECT") {
      const updated = await prisma.payment.update({
        where: { id },
        data: {
          status: "REJECTED",
          rejectReason: reason.trim(),
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        },
      });
      await prisma.notification.create({
        data: {
          userId: payment.userId,
          title: "Payment rejected",
          body: reason.trim(),
          type: "PAYMENT",
          link: "/dashboard",
        },
      });
      await log(admin.id, "REJECT_PAYMENT", "Payment", id, reason);
      return NextResponse.json({ ...updated, message: "Payment rejected" });
    }

    // APPROVE
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedBy: admin.id,
          reviewedAt: new Date(),
        },
      });

      if (payment.reservationId) {
        const res = await tx.reservation.findUnique({ where: { id: payment.reservationId } });
        if (res) {
          const amountPaid = (res.amountPaid || 0) + payment.amount;
          const total = res.totalAmount || res.deposit;
          let status = res.status;
          if (amountPaid >= total) status = "FULLY_PAID";
          else if (amountPaid > 0) status = "PARTIALLY_PAID";
          else status = "CONFIRMED";

          await tx.reservation.update({
            where: { id: res.id },
            data: { amountPaid, status },
          });

          if (payment.installmentId) {
            await tx.installment.update({
              where: { id: payment.installmentId },
              data: { status: "PAID", paidAt: new Date(), paymentId: id },
            }).catch(() => null);
          }

          if (status === "FULLY_PAID") {
            await tx.asset.update({
              where: { id: res.assetId },
              data: { status: "SOLD" },
            });
          } else {
            await tx.asset.update({
              where: { id: res.assetId },
              data: { status: "RESERVED" },
            });
          }
        }
      }

      return updated;
    });

    await prisma.notification.create({
      data: {
        userId: payment.userId,
        title: "Payment approved",
        body: `Your payment of ${payment.amount} was approved.`,
        type: "PAYMENT",
        link: "/dashboard",
      },
    });
    await log(admin.id, "APPROVE_PAYMENT", "Payment", id, `amount=${payment.amount}`);
    return NextResponse.json({ ...result, message: "Payment approved" });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }
}
