import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/admin-activity";
import { healSchema } from "@/lib/schema-heal";
import { applyPaymentToReservation } from "@/lib/apply-payment";
import { issueContractForUser } from "@/lib/contracts";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

function normalizeAction(body: Record<string, unknown>): "APPROVE" | "REJECT" | null {
  const raw = String(body.action || body.status || "")
    .trim()
    .toUpperCase();
  if (["APPROVE", "APPROVED", "ACCEPT"].includes(raw)) return "APPROVE";
  if (["REJECT", "REJECTED"].includes(raw)) return "REJECT";
  return null;
}

async function processOne(
  admin: { id: string; email?: string | null; name?: string | null },
  id: string,
  action: "APPROVE" | "REJECT",
  reason: string | null
) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      reservation: true,
    },
  });
  if (!payment) return { id, ok: false, error: "Not found" };
  if (payment.status === "APPROVED" && action === "APPROVE") {
    return { id, ok: true, skipped: true, message: "Already approved" };
  }
  if (payment.status === "REJECTED" && action === "REJECT") {
    return { id, ok: true, skipped: true, message: "Already rejected" };
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
      await prisma.toolRental
        .update({
          where: { id: payment.toolRentalId },
          data: { status: "CONFIRMED", expiresAt: null },
        })
        .catch(() => null);
    }
    if (payment.hireRequestId) {
      await prisma.hireRequest
        .update({
          where: { id: payment.hireRequestId },
          data: { status: "CONFIRMED", expiresAt: null },
        })
        .catch(() => null);
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

      try {
        await issueContractForUser({
          userId: payment.userId,
          reservationId: payment.reservationId || null,
        });
      } catch (e) {
        console.error("auto contract issue", e);
      }
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
  }).catch(() => null);

  return { id, ok: true, status: action === "APPROVE" ? "APPROVED" : "REJECTED" };
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
      take: 200,
    });
    return NextResponse.json(payments);
  } catch (e) {
    console.error(e);
    try {
      const payments = await prisma.payment.findMany({
        where: status && status !== "ALL" ? { status } : undefined,
        orderBy: { createdAt: "desc" },
        take: 200,
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
    const action = normalizeAction(body);
    const reason =
      body.reason != null
        ? String(body.reason)
        : body.rejectReason != null
          ? String(body.rejectReason)
          : null;

    if (!action) {
      return NextResponse.json(
        {
          error: "action/status required",
          hint: 'Send { id, action } or { ids: [...], action: "APPROVE"|"REJECT" }',
        },
        { status: 400 }
      );
    }

    const idsRaw = body.ids;
    if (Array.isArray(idsRaw) && idsRaw.length) {
      const ids = idsRaw.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 50);
      const results = [];
      for (const id of ids) {
        results.push(await processOne(admin, id, action, reason));
      }
      const ok = results.filter((r) => r.ok).length;
      return NextResponse.json({
        ok: true,
        bulk: true,
        processed: results.length,
        succeeded: ok,
        results,
        message: `${ok} of ${results.length} payment(s) ${action === "APPROVE" ? "approved" : "rejected"}`,
      });
    }

    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "id or ids required" }, { status: 400 });
    }

    const result = await processOne(admin, id, action, reason);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Failed" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      action,
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      ...result,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Update failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
