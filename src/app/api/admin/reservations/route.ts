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

  if (["CANCELLED", "EXPIRED", "REJECTED"].includes(reservation.status)) {
    return { id, ok: false, error: `Already ${reservation.status}` };
  }

  const paid = (reservation.payments || []).reduce(
    (s: number, p: any) => s + Number(p.amount || 0),
    0
  );
  const installmentPaid = Number((reservation as any).installmentPaid || 0);
  const totalPaid = Math.max(paid, installmentPaid);

  let deducted = 0;
  let refundAmount = totalPaid;
  let refundNote = "Full refund (no deduction).";
  if (refundMode === "DEDUCT_10") {
    const summary = cancelRefundSummary(totalPaid);
    deducted = summary.deducted;
    refundAmount = summary.refundAmount;
    refundNote = summary.message;
  } else {
    refundNote = `Full refund of NGN ${totalPaid.toLocaleString("en-NG")}. Processed within 7 days.`;
  }

  const cancelReason = [
    reason || "Cancelled by admin",
    `Refund: ${refundMode === "FULL" ? "100% (full)" : "90% after 10% deduction"}`,
    totalPaid > 0
      ? `Paid NGN ${totalPaid.toLocaleString("en-NG")}, deduct NGN ${deducted.toLocaleString("en-NG")}, refund NGN ${refundAmount.toLocaleString("en-NG")}`
      : "No approved payments on record",
  ].join(" | ");

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

  const other = await prisma.reservation.findFirst({
    where: {
      assetId: reservation.assetId,
      id: { not: id },
      status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
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
        body: `Your reservation was cancelled by admin. ${refundNote}`,
        type: "RESERVATION",
        link: "/dashboard#reservations",
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
    details: {
      reason,
      refundMode,
      totalPaid,
      deducted,
      refundAmount,
      assetId: reservation.assetId,
    },
    alsoNotifyEmails: user?.email ? [user.email] : [],
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
          hint: "ACCEPT | CANCEL | CLEANUP, with id or ids[]",
        },
        { status: 400 }
      );
    }

    if (!ids.length) {
      return NextResponse.json({ error: "id or ids required" }, { status: 400 });
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
          await prisma.contract
            .updateMany({ where: { reservationId: id }, data: { reservationId: null as any } })
            .catch(() => null);
          await prisma.reservation.delete({ where: { id } });
          results.push({ id, ok: true });
        } catch (e) {
          results.push({
            id,
            ok: false,
            error: e instanceof Error ? e.message : "Delete failed",
          });
        }
      }
      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "RESERVATION_CLEANUP",
        entity: "Reservation",
        details: { count: results.filter((x) => x.ok).length, ids },
      }).catch(() => null);
      return NextResponse.json({
        ok: true,
        bulk: true,
        results,
        message: `Cleaned ${results.filter((x) => x.ok).length} of ${results.length}`,
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
      const user = await prisma.user.findUnique({
        where: { id: reservation.userId },
        select: { email: true },
      });
      await prisma.notification
        .create({
          data: {
            userId: reservation.userId,
            title: "Reservation confirmed",
            body: "Your reservation was accepted by admin.",
            type: "RESERVATION",
            link: "/dashboard#reservations",
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

    const reason = body.reason ? String(body.reason).slice(0, 500) : "Cancelled by admin";
    const refundMode =
      String(body.refundMode || body.refund || "DEDUCT_10").toUpperCase() === "FULL"
        ? "FULL"
        : "DEDUCT_10";

    const results = [];
    for (const id of ids) {
      results.push(await cancelOne(admin, id, reason, refundMode));
    }
    const ok = results.filter((r) => r.ok).length;
    return NextResponse.json({
      ok: ok > 0,
      bulk: ids.length > 1,
      results,
      message: `Cancelled ${ok} of ${results.length}`,
      refundMode,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Update failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
