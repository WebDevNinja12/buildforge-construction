import { prisma } from "./prisma";

const AUTO_APPROVE_HOURS = 12;
const RESERVATION_PAYMENT_HOURS = 24;

/** Auto-approve clients pending longer than 12 hours */
export async function autoApprovePendingUsers() {
  const cutoff = new Date(Date.now() - AUTO_APPROVE_HOURS * 60 * 60 * 1000);
  const result = await prisma.user.updateMany({
    where: {
      role: "CLIENT",
      status: "PENDING_APPROVAL",
      createdAt: { lte: cutoff },
    },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });
  return result.count;
}

/** Expire unpaid reservations and free assets */
export async function expireUnpaidReservations() {
  const now = new Date();
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    select: { id: true, assetId: true },
  });

  for (const r of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: r.id },
        data: { status: "EXPIRED" },
      });
      await tx.payment.updateMany({
        where: { reservationId: r.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      // Only free asset if no other active reservation holds it
      const other = await tx.reservation.findFirst({
        where: {
          assetId: r.assetId,
          id: { not: r.id },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });
      if (!other) {
        await tx.asset.update({
          where: { id: r.assetId },
          data: { status: "AVAILABLE" },
        });
      }
    });
  }
  return expired.length;
}

/** Expire unpaid tool rentals and restore quantity */
export async function expireUnpaidRentals() {
  const now = new Date();
  const expired = await prisma.toolRental.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
  });

  for (const r of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.toolRental.update({
        where: { id: r.id },
        data: { status: "EXPIRED" },
      });
      await tx.payment.updateMany({
        where: { toolRentalId: r.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      await tx.tool.update({
        where: { id: r.toolId },
        data: { available: { increment: r.quantity } },
      });
    });
  }
  return expired.length;
}

/** Run all background maintenance tasks */
export async function runMaintenance() {
  const [users, reservations, rentals] = await Promise.all([
    autoApprovePendingUsers(),
    expireUnpaidReservations(),
    expireUnpaidRentals(),
  ]);
  return { users, reservations, rentals };
}

export { AUTO_APPROVE_HOURS, RESERVATION_PAYMENT_HOURS };
