import { prisma } from "@/lib/prisma";

const DEFAULT_HOURS: Record<string, number> = {
  HOUSE: 14 * 24,
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
    /* table may not exist yet during migrate */
  }
  return DEFAULT_HOURS[category] ?? 24;
}

export async function ensureCategoryDefaults() {
  const defaults = [
    { category: "HOUSE", name: "House / Building", defaultExpiryHours: 14 * 24, sortOrder: 1 },
    { category: "HOTEL", name: "Hotel", defaultExpiryHours: 7 * 24, sortOrder: 2 },
    { category: "LAND", name: "Land", defaultExpiryHours: 5 * 24, sortOrder: 3 },
    { category: "TOOLS", name: "Tools", defaultExpiryHours: 48, sortOrder: 4 },
    { category: "WORKERS", name: "Workers", defaultExpiryHours: 12, sortOrder: 5 },
    { category: "OTHER", name: "Other Construction", defaultExpiryHours: 24, sortOrder: 6 },
  ];
  for (const d of defaults) {
    await prisma.categoryDefault.upsert({
      where: { category: d.category },
      create: d,
      update: {},
    });
  }
}

async function notify(userId: string, title: string, body: string, type = "INFO", link?: string) {
  try {
    await prisma.notification.create({
      data: { userId, title, body, type, link },
    });
  } catch (e) {
    console.error("notify failed", e);
  }
}

/** Expire unpaid reservations, send reminders, auto-approve users after 12h */
export async function runMaintenance() {
  const now = new Date();

  // 1. Expire pending reservations past expiresAt
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    include: { asset: true },
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
      const other = await tx.reservation.findFirst({
        where: {
          assetId: r.assetId,
          id: { not: r.id },
          status: { in: ["PENDING", "CONFIRMED", "PARTIALLY_PAID"] },
        },
      });
      if (!other) {
        await tx.asset.update({
          where: { id: r.assetId },
          data: { status: "AVAILABLE" },
        });
      }
    });
    await notify(
      r.userId,
      "Reservation expired",
      `Your hold on "${r.asset.title}" expired because payment was not completed in time. The listing is available again.`,
      "RESERVATION",
      "/dashboard"
    );
  }

  // 2. Reminders 24h and 1h before expiry
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const soon24 = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      reminder24hSent: false,
      expiresAt: { gte: in23h, lte: in25h },
    },
    include: { asset: true },
  });
  for (const r of soon24) {
    await prisma.reservation.update({
      where: { id: r.id },
      data: { reminder24hSent: true },
    });
    await notify(
      r.userId,
      "Payment due in ~24 hours",
      `Complete payment for "${r.asset.title}" within 24 hours or the reservation will expire.`,
      "RESERVATION",
      "/dashboard"
    );
  }

  const in90m = new Date(now.getTime() + 90 * 60 * 1000);
  const in30m = new Date(now.getTime() + 30 * 60 * 1000);
  const soon1h = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      reminder1hSent: false,
      expiresAt: { gte: in30m, lte: in90m },
    },
    include: { asset: true },
  });
  for (const r of soon1h) {
    await prisma.reservation.update({
      where: { id: r.id },
      data: { reminder1hSent: true },
    });
    await notify(
      r.userId,
      "Payment due in about 1 hour",
      `Last chance: pay for "${r.asset.title}" before the reservation is released.`,
      "RESERVATION",
      "/dashboard"
    );
  }

  // 3. Auto-approve clients after 12 hours (still UNDER_REVIEW for docs)
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const pendingUsers = await prisma.user.findMany({
    where: {
      role: "CLIENT",
      status: { in: ["PENDING_APPROVAL", "UNDER_REVIEW"] },
      approvedAt: null,
      createdAt: { lt: twelveHoursAgo },
    },
  });
  for (const u of pendingUsers) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        status: "UNDER_REVIEW",
        approvedAt: now,
        verificationStatus: u.verificationStatus === "PENDING" ? "UNDER_REVIEW" : u.verificationStatus,
      },
    });
    await notify(
      u.id,
      "Account auto-approved",
      "You can now use the platform. Final document verification is still pending (status: Under Review).",
      "VERIFICATION",
      "/dashboard"
    );
  }

  return {
    expiredReservations: expired.length,
    reminders24h: soon24.length,
    reminders1h: soon1h.length,
    autoApprovedUsers: pendingUsers.length,
  };
}
