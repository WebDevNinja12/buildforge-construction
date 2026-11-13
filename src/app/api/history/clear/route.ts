import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const TERMINAL_RES = new Set([
  "CANCELLED",
  "EXPIRED",
  "FULLY_PAID",
  "COMPLETED",
  "REFUNDED",
]);

async function readHiddenIds(key: string): Promise<string[]> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    if (!row?.value) return [];
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function writeHiddenIds(key: string, ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  await prisma.siteSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(unique) },
    create: { key, value: JSON.stringify(unique) },
  });
  return unique;
}

/**
 * Client history tools:
 * - clear all completed (timestamp + optional notifications)
 * - multi-select hide: reservationIds / paymentIds / contractIds (terminal / own only)
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "ADMIN") {
    return NextResponse.json(
      { error: "Admins use Admin panel filters; clients clear their own history here." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const clearNotifications = body.clearNotifications !== false;
  const hideCompleted = body.hideCompleted !== false;
  const reservationIds = Array.isArray(body.reservationIds)
    ? body.reservationIds.map(String).filter(Boolean)
    : [];
  const paymentIds = Array.isArray(body.paymentIds)
    ? body.paymentIds.map(String).filter(Boolean)
    : [];
  const contractIds = Array.isArray(body.contractIds)
    ? body.contractIds.map(String).filter(Boolean)
    : [];
  const hasSelect =
    reservationIds.length > 0 || paymentIds.length > 0 || contractIds.length > 0;

  let deletedNotifications = 0;
  let hiddenReservations = 0;
  let hiddenPayments = 0;
  let hiddenContracts = 0;

  if (hasSelect) {
    if (reservationIds.length) {
      const owned = await prisma.reservation.findMany({
        where: { id: { in: reservationIds }, userId: session.id },
        select: { id: true, status: true },
      });
      const allowed = owned
        .filter((r) => TERMINAL_RES.has(String(r.status || "").toUpperCase()))
        .map((r) => r.id);
      if (allowed.length) {
        const key = `history_hidden_reservations_${session.id}`;
        const prev = await readHiddenIds(key);
        await writeHiddenIds(key, [...prev, ...allowed]);
        hiddenReservations = allowed.length;
      }
    }
    if (paymentIds.length) {
      const owned = await prisma.payment.findMany({
        where: { id: { in: paymentIds }, userId: session.id },
        select: { id: true },
      });
      const allowed = owned.map((p) => p.id);
      if (allowed.length) {
        const key = `history_hidden_payments_${session.id}`;
        const prev = await readHiddenIds(key);
        await writeHiddenIds(key, [...prev, ...allowed]);
        hiddenPayments = allowed.length;
      }
    }
    if (contractIds.length) {
      try {
        const owned = await prisma.contract.findMany({
          where: { id: { in: contractIds }, userId: session.id },
          select: { id: true },
        });
        const allowed = owned.map((c) => c.id);
        if (allowed.length) {
          const key = `history_hidden_contracts_${session.id}`;
          const prev = await readHiddenIds(key);
          await writeHiddenIds(key, [...prev, ...allowed]);
          hiddenContracts = allowed.length;
        }
      } catch {
        /* contract model may vary */
      }
    }
  } else {
    if (clearNotifications) {
      const r = await prisma.notification.deleteMany({ where: { userId: session.id } });
      deletedNotifications = r.count;
    }

    if (hideCompleted) {
      const key = `history_cleared_at_${session.id}`;
      await prisma.siteSetting.upsert({
        where: { key },
        update: { value: new Date().toISOString() },
        create: { key, value: new Date().toISOString() },
      });
    }
  }

  await prisma.adminActivityLog
    .create({
      data: {
        adminId: session.id,
        action: hasSelect ? "CLIENT_HIDE_SELECTED" : "CLIENT_CLEAR_HISTORY",
        entity: "User",
        entityId: session.id,
        details: JSON.stringify({
          deletedNotifications,
          hideCompleted: hasSelect ? false : hideCompleted,
          hiddenReservations,
          hiddenPayments,
          hiddenContracts,
        }),
      },
    })
    .catch(() => null);

  return NextResponse.json({
    ok: true,
    deletedNotifications,
    hideCompleted: hasSelect ? false : hideCompleted,
    hiddenReservations,
    hiddenPayments,
    hiddenContracts,
    message: hasSelect
      ? `Removed ${hiddenReservations + hiddenPayments + hiddenContracts} selected item(s) from your history.`
      : "History cleared. Active reservations stay visible. Completed/cancelled items are hidden. Notifications removed.",
  });
}

/** GET hidden id lists for the current client (used by dashboard filters). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "ADMIN") {
    return NextResponse.json({ reservations: [], payments: [], contracts: [], clearedAt: null });
  }
  const [reservations, payments, contracts, cleared] = await Promise.all([
    readHiddenIds(`history_hidden_reservations_${session.id}`),
    readHiddenIds(`history_hidden_payments_${session.id}`),
    readHiddenIds(`history_hidden_contracts_${session.id}`),
    prisma.siteSetting
      .findUnique({ where: { key: `history_cleared_at_${session.id}` } })
      .then((r) => r?.value || null)
      .catch(() => null),
  ]);
  return NextResponse.json({ reservations, payments, contracts, clearedAt: cleared });
}
