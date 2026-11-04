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
  if (override != null && Number(override) > 0) return Number(override);
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

/** Expire unpaid holds, free stuck assets, auto-approve stale registrations */
export async function runMaintenance() {
  const now = new Date();
  let expiredCount = 0;
  let freedAssets = 0;
  let expiredRentals = 0;
  let expiredHires = 0;
  let autoApproved = 0;

  // 1) Expire unpaid asset reservations
  try {
    const expired = await prisma.reservation.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        expiresAt: { lt: now },
        OR: [{ installmentPaid: 0 }, { installmentPaid: null as any }],
        paidAt: null,
      },
      include: { asset: true },
    });

    for (const r of expired) {
      // Keep confirmed+partially paid plans; only expire pure unpaid holds
      const paid = Number(r.installmentPaid || 0);
      if (paid > 0 || r.paidAt) continue;

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
    console.error("maintenance expire reservations", e);
  }

  // 2) Free assets stuck RESERVED with no active reservation
  try {
    const reservedAssets = await prisma.asset.findMany({
      where: { status: "RESERVED", active: true },
      select: { id: true },
    });
    for (const a of reservedAssets) {
      const activeHold = await prisma.reservation.findFirst({
        where: {
          assetId: a.id,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });
      if (!activeHold) {
        await prisma.asset.update({
          where: { id: a.id },
          data: { status: "AVAILABLE" },
        });
        freedAssets++;
      }
    }
  } catch (e) {
    console.error("maintenance free assets", e);
  }

  // 3) Expire tool rentals
  try {
    const rentals = await prisma.toolRental.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
      },
      include: { tool: true },
    });
    for (const r of rentals) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.toolRental.update({
            where: { id: r.id },
            data: { status: "EXPIRED" },
          });
          await tx.tool.update({
            where: { id: r.toolId },
            data: { available: { increment: 1 } },
          });
        });
        expiredRentals++;
        await notify(
          r.userId,
          "Tool reservation expired",
          "Your tool hold ended without payment. Stock was released.",
          "RESERVATION",
          "/dashboard"
        );
      } catch (e) {
        console.error("expire tool rental", r.id, e);
      }
    }
  } catch (e) {
    console.error("maintenance tool rentals", e);
  }

  // 4) Expire worker hires — reactivate worker
  try {
    const hires = await prisma.hireRequest.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
      },
    });
    for (const h of hires) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.hireRequest.update({
            where: { id: h.id },
            data: { status: "EXPIRED" },
          });
          if (h.workerId) {
            await tx.worker.update({
              where: { id: h.workerId },
              data: { active: true },
            });
          }
        });
        expiredHires++;
        await notify(
          h.userId,
          "Worker hire expired",
          "Your hire hold ended without payment.",
          "RESERVATION",
          "/dashboard"
        );
      } catch (e) {
        console.error("expire hire", h.id, e);
      }
    }
  } catch (e) {
    console.error("maintenance hires", e);
  }

  // 5) Auto-approve stale client registrations (12h)
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

  return {
    expiredReservations: expiredCount,
    freedAssets,
    expiredRentals,
    expiredHires,
    autoApprovedUsers: autoApproved,
  };
}
