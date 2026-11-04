import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/admin-activity";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
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
      take: 100,
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
    const { id, action, reason } = await req.json();
    if (!id || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "id and action (APPROVE|REJECT) required" }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    if (action === "APPROVE") {
      await prisma.payment.update({
        where: { id },
        data: { status: "APPROVED", method: payment.method || "ADMIN" },
      });
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
          // store reason in method/notes if no reason field
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
      details: { amount: payment.amount, reason: reason || null, client: payment.user?.email },
      alsoNotifyEmails: payment.user?.email ? [payment.user.email] : [],
    });

    return NextResponse.json({ ok: true, action });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
