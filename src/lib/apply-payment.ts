import { prisma } from "@/lib/prisma";

function parseSchedule(json: string | null | undefined) {
  if (!json) return [] as Array<{ sequence: number; amount: number; dueDate: string; status?: string }>;
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Apply an approved payment amount to a reservation: update paid, schedule, FULLY_PAID */
export async function applyPaymentToReservation(amount: number, reservationId: string) {
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

/** Notify all admin accounts */
export async function notifyAdmins(title: string, body: string, type = "PAYMENT") {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
    take: 20,
  });
  for (const a of admins) {
    await prisma.notification
      .create({
        data: { userId: a.id, title, body, type },
      })
      .catch(() => null);
  }
}
