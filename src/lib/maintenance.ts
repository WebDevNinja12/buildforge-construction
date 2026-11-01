import { prisma } from "@/lib/prisma";

const DEFAULT_HOURS: Record<string, number> = {
  HOUSE: 14 * 24,
  BUILDING: 14 * 24,
  APARTMENT: 14 * 24,
  COMMERCIAL: 14 * 24,
  HOTEL: 7 * 24,
  LAND: 5 * 24,
  TOOLS: 48,
  WORKERS: 12,
  OTHER: 24,
};

export async function getExpiryHours(category: string, override?: number | null) {
  if (override != null && override > 0) return override;
  try {
    const row = await prisma.categoryDefault.findUnique({ where: { category } });
    if (row?.defaultExpiryHours) return row.defaultExpiryHours;
  } catch {
    /* */
  }
  return DEFAULT_HOURS[category] ?? 24;
}

export async function getCategoryConfig(category: string) {
  try {
    const row = await prisma.categoryDefault.findUnique({ where: { category } });
    if (row) return { ...row, requiredDocs: [] as any[] };
  } catch {
    /* */
  }
  return {
    category,
    name: category,
    defaultExpiryHours: DEFAULT_HOURS[category] ?? 24,
    cancelDeductionPercent: 0,
    requiredDocs: [] as any[],
  };
}

async function notify(
  userId: string,
  title: string,
  body: string,
  type: string,
  link?: string
) {
  try {
    await prisma.notification.create({
      data: { userId, title, body, type, link: link || null },
    });
  } catch {
    /* */
  }
}

/** Expire unpaid holds and auto-approve stale registrations */
export async function runMaintenance() {
  const now = new Date();
  let expiredCount = 0;
  let autoApproved = 0;

  try {
    const expired = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
        installmentPaid: 0,
      },
      include: { asset: true },
    });

    for (const r of expired) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.reservation.update({
            where: { id: r.id },
            data: { status: "EXPIRED" },
          });
          await tx.payment.updateMany({
            where: { reservationId: r.id, status: "PENDING" },
            data: { status: "FAILED" },
          });
          if (r.asset && r.asset.status === "RESERVED") {
            await tx.asset.update({
              where: { id: r.assetId },
              data: { status: "AVAILABLE" },
            });
          }
        });
        expiredCount++;
        await notify(
          r.userId,
          "Reservation expired",
          "Your reservation hold ended without payment. The item is available again.",
          "RESERVATION",
          "/dashboard"
        );
      } catch (e) {
        console.error("expire reservation", r.id, e);
      }
    }
  } catch (e) {
    console.error("maintenance expire", e);
  }

  try {
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const pendingUsers = await prisma.user.findMany({
      where: {
        role: "CLIENT",
        status: "PENDING_APPROVAL",
        createdAt: { lt: cutoff },
        deletedAt: null,
      },
      take: 50,
    });
    for (const u of pendingUsers) {
      try {
        await prisma.user.update({
          where: { id: u.id },
          data: {
            status: "UNDER_REVIEW",
            approvedAt: now,
            verificationStatus:
              u.verificationStatus === "PENDING" ? "UNDER_REVIEW" : u.verificationStatus,
          },
        });
        autoApproved++;
        await notify(
          u.id,
          "Account auto-approved",
          "You can use the platform. Final document verification may still be pending.",
          "VERIFICATION",
          "/dashboard"
        );
      } catch (e) {
        console.error("auto-approve", u.id, e);
      }
    }
  } catch (e) {
    console.error("maintenance auto-approve", e);
  }

  return { expiredReservations: expiredCount, autoApprovedUsers: autoApproved };
}
