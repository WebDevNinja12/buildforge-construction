import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/admin-activity";
import { healSchema } from "@/lib/schema-heal";
import { cancelRefundSummary } from "@/lib/booking-rules";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

function normalizeAction(body: Record<string, unknown>): string | null {
  const raw = String(body.action || body.status || "")
    .trim()
    .toUpperCase();
  if (["ACCEPT", "APPROVE", "APPROVED", "CONFIRM"].includes(raw)) return "ACCEPT";
  if (["REJECT", "REJECTED", "CANCEL"].includes(raw)) return "CANCEL";
  if (["CLEANUP", "PURGE_HISTORY", "DELETE_HISTORY"].includes(raw)) return "CLEANUP";
  if (["MARK_REFUND", "REFUND_PROCESSED", "NOTE"].includes(raw)) return "MARK_REFUND";
  return null;
}

async function cancelOne(
  admin: { id: string; email?: string | null; name?: string | null },
  id: string,
  reason: string,
  refundMode: "FULL" | "DEDUCT_10"
) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      payments: { where: { status: { in: ["APPROVED", "COMPLETED", "CONFIRMED"] } } },
    },
  });
  if (!reservation) return { id, ok: false, error: "Not found" };

  if (!["PENDING", "CONFIRMED", "ACTIVE"].includes(reservation.status)) {
    if (reservation.status === "FULLY_PAID" || reservation.status === "COMPLETED") {
      // still allow admin cancel with refund options
    } else if (reservation.status === "CANCELLED" || reservation.status === "EXPIRED") {
      return { id, ok: false, error: `Already ${reservation.status}` };
    }
  }

  const totalPaid = (reservation.payments || []).reduce(
    (s, p) => s + Number(p.amount || 0),
    0
  );
  let deducted = 0;
  let refundAmount = totalPaid;
  let refundNote = "Full refund (no deduction).";
  if (refundMode === "DEDUCT_10") {
    const summary = cancelRefundSummary(totalPaid);
    deducted = summary.deducted;
    refundAmount = summary.refundAmount;
    refundNote = summary.message;
  } else {
    refundNote = `Full refund of ₦${totalPaid.toLocaleString("en-NG")}. Processed within 7 days.`;
  }

  const cancelReason = [
    reason || "Cancelled by admin",
    `Refund: ${refundMode === "FULL" ? "100% (full)" : "90% after 10% deduction"}`,
    totalPaid > 0
      ? `Paid ₦${totalPaid.toLocaleString("en-NG")}, deduct ₦${deducted.toLocaleString("en-NG")}, refund ₦${refundAmount.toLocaleString("en-NG")}`
      : "No approved payments to refund",
  ]
    .filter(Boolean)
    .join(" · ");

  await prisma.reservation.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelReason: cancelReason.slice(0, 900),
    },
  });

  await prisma.payment
    .updateMany({
      where: { reservationId: id, status: "PENDING" },
      data: { status: "FAILED" },
    })
    .catch(() => null);

  if (reservation.assetId) {
    try {
      await prisma.$executeRaw`
      UPDATE "Asset" SET status = 'AVAILABLE', "updatedAt" = ${new Date()}
      WHERE id = ${reservation.assetId}`;
    } catch {
      /* */
    }
  }

  try {
    await prisma.notification.create({
      data: {
        userId: reservation.userId,
        title: "Plan cancelled",
        body: `Your reservation was cancelled by admin. ${refundNote}`,
        type: "RESERVATION",
        link: "/dashboard#reservations",
      },
    });
  } catch {
    /* */
  }

  await recordAdminActivity({
    adminId: admin.id,
    adminEmail: admin.email,
    adminName: admin.name,
    action: "RESERVATION_CANCEL",
    entity: "Reservation",
    entityId: id,
    details: {
      refundMode,
      totalPaid,
      deducted,
      refundAmount,
      reason: cancelReason.slice(0, 200),
    },
  }).catch(() => null);

  return {
    id,
    ok: true,
    status: "CANCELLED",
    refundMode,
    totalPaid,
    deducted,
    refundAmount,
  };
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
      take: 300,
    });
    return NextResponse.json(reservations);
  } catch (e) {
    try {
      const reservations = await prisma.reservation.findMany({
        orderBy: { createdAt: "desc" },
        take: 300,
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
    const action = normalizeAction(body);
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 50)
      : body.id
        ? [String(body.id).trim()]
        : [];

    if (!action) {
      return NextResponse.json(
        {
          error: "action required",
          hint: "ACCEPT | CANCEL | CLEANUP | MARK_REFUND, with id or ids[]",
        },
        { status: 400 }
      );
    }

    if (!ids.length) {
      return NextResponse.json({ error: "id or ids required" }, { status: 400 });
    }

    if (action === "MARK_REFUND") {
      const results = [];
      for (const id of ids) {
        const r = await prisma.reservation.findUnique({ where: { id } });
        if (!r) {
          results.push({ id, ok: false, error: "Not found" });
          continue;
        }
        const st = String(r.status || "").toUpperCase();
        if (!["CANCELLED", "REJECTED", "EXPIRED"].includes(st)) {
          results.push({ id, ok: false, error: `Not a cancelled record (${st})` });
          continue;
        }
        const reason =
          String(body.reason || "").trim() ||
          `${r.cancelReason || "Cancelled"}\n[Refund processed ${new Date().toISOString().slice(0, 10)}]`;
        await prisma.reservation.update({
          where: { id },
          data: { cancelReason: reason.slice(0, 900) },
        });
        await recordAdminActivity({
          adminId: admin.id,
          adminEmail: admin.email,
          adminName: admin.name,
          action: "REFUND_MARKED",
          entity: "Reservation",
          entityId: id,
          details: { reason: reason.slice(0, 200) },
        }).catch(() => null);
        results.push({ id, ok: true });
      }
      return NextResponse.json({
        ok: true,
        results,
        okCount: results.filter((x) => x.ok).length,
      });
    }

    if (action === "CLEANUP") {
      const results = [];
      for (const id of ids) {
        const r = await prisma.reservation.findUnique({ where: { id } });
        if (!r) {
          results.push({ id, ok: false, error: "Not found" });
          continue;
        }
        const st = String(r.status || "").toUpperCase();
        if (!["CANCELLED", "EXPIRED", "REJECTED", "FULLY_PAID", "COMPLETED"].includes(st)) {
          results.push({ id, ok: false, error: `Cannot cleanup active status ${st}` });
          continue;
        }
        try {
          await prisma.payment.deleteMany({ where: { reservationId: id } }).catch(() => null);
          await prisma.reservation.delete({ where: { id } });
          results.push({ id, ok: true });
        } catch (e) {
          results.push({
            id,
            ok: false,
            error: e instanceof Error ? e.message : "delete failed",
          });
        }
      }
      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "RESERVATION_CLEANUP",
        entity: "Reservation",
        details: { count: results.filter((x) => x.ok).length },
      }).catch(() => null);
      return NextResponse.json({
        ok: true,
        results,
        okCount: results.filter((x) => x.ok).length,
      });
    }

    if (action === "ACCEPT") {
      const id = ids[0];
      const reservation = await prisma.reservation.findUnique({ where: { id } });
      if (!reservation) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (reservation.status !== "PENDING") {
        return NextResponse.json(
          { error: `Only PENDING can be accepted (now ${reservation.status})` },
          { status: 400 }
        );
      }
      await prisma.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
      });
      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "RESERVATION_ACCEPT",
        entity: "Reservation",
        entityId: id,
      }).catch(() => null);
      return NextResponse.json({ ok: true, message: "Reservation accepted", status: "CONFIRMED" });
    }

    if (action === "CANCEL") {
      const reason = String(body.reason || "Cancelled by admin").trim();
      const refundMode =
        String(body.refundMode || "DEDUCT_10").toUpperCase() === "FULL" ? "FULL" : "DEDUCT_10";
      const results = [];
      for (const id of ids) {
        results.push(await cancelOne(admin, id, reason, refundMode));
      }
      return NextResponse.json({
        ok: true,
        results,
        okCount: results.filter((x) => x.ok).length,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
