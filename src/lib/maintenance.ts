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

const DEFAULT_DEDUCTION: Record<string, number> = {
  HOTEL: 20,
  TOOLS: 15,
  WORKERS: 10,
  HOUSE: 0,
  LAND: 0,
};

export async function getExpiryHours(category: string, override?: number | null) {
  if (override != null && override > 0) return override;
  try {
    const row = await prisma.categoryDefault.findUnique({ where: { category } });
    if (row?.defaultExpiryHours) return row.defaultExpiryHours;
  } catch { /* */ }
  return DEFAULT_HOURS[category] ?? 24;
}

export async function getCategoryConfig(category: string) {
  try {
    const row = await prisma.categoryDefault.findUnique({ where: { category } });
    if (row) {
      const requiredDocs = await prisma.requiredDocumentType.findMany({
        where: { category, active: true },
        orderBy: { sortOrder: "asc" },
      });
      return { ...row, requiredDocs };
    }
  } catch { /* */ }
  return {
    category,
    name: category,
    defaultExpiryHours: DEFAULT_HOURS[category] ?? 24,
    installmentPlanMonths: ["HOUSE", "LAND", "APARTMENT"].includes(category)
      ? category === "LAND"
        ? 12
        : 6
      : null,
    cancelDeductionPercent: DEFAULT_DEDUCTION[category] ?? 10,
    graceHours: 24,
    continuesAfterHold: ["HOUSE", "LAND", "APARTMENT", "COMMERCIAL"].includes(category),
    installmentRulesText: defaultRulesText(category),
    requiredDocs: [] as { key: string; label: string; required: boolean }[],
  };
}

function defaultRulesText(category: string): string {
  if (["HOUSE", "LAND", "APARTMENT", "COMMERCIAL"].includes(category)) {
    return (
      "Installment continues after the reservation hold. " +
      "You must pay the first deposit before the hold expires or the listing is released. " +
      "After the first deposit is approved, you enter an Installment Plan with a longer plan deadline set by admin. " +
      "Your dashboard will show total price, amount paid, balance, and next due date."
    );
  }
  return (
    "Installments for this category must be completed within the reservation period. " +
    "If the period ends with a balance unpaid, you receive a notice and a short grace window. " +
    "If still unpaid, the reservation is cancelled and you are refunded minus a cancellation deduction."
  );
}

export async function ensureCategoryDefaults() {
  const defaults = [
    {
      category: "HOUSE",
      name: "House / Building",
      defaultExpiryHours: 14 * 24,
      installmentPlanMonths: 6,
      cancelDeductionPercent: 0,
      graceHours: 24,
      continuesAfterHold: true,
      sortOrder: 1,
      installmentRulesText: defaultRulesText("HOUSE"),
    },
    {
      category: "HOTEL",
      name: "Hotel",
      defaultExpiryHours: 7 * 24,
      installmentPlanMonths: null,
      cancelDeductionPercent: 20,
      graceHours: 24,
      continuesAfterHold: false,
      sortOrder: 2,
      installmentRulesText: defaultRulesText("HOTEL"),
    },
    {
      category: "LAND",
      name: "Land",
      defaultExpiryHours: 5 * 24,
      installmentPlanMonths: 12,
      cancelDeductionPercent: 0,
      graceHours: 24,
      continuesAfterHold: true,
      sortOrder: 3,
      installmentRulesText: defaultRulesText("LAND"),
    },
    {
      category: "TOOLS",
      name: "Tools",
      defaultExpiryHours: 48,
      installmentPlanMonths: null,
      cancelDeductionPercent: 15,
      graceHours: 12,
      continuesAfterHold: false,
      sortOrder: 4,
      installmentRulesText: defaultRulesText("TOOLS"),
    },
    {
      category: "WORKERS",
      name: "Workers",
      defaultExpiryHours: 12,
      installmentPlanMonths: null,
      cancelDeductionPercent: 10,
      graceHours: 6,
      continuesAfterHold: false,
      sortOrder: 5,
      installmentRulesText: defaultRulesText("WORKERS"),
    },
    {
      category: "OTHER",
      name: "Other Construction",
      defaultExpiryHours: 24,
      installmentPlanMonths: null,
      cancelDeductionPercent: 10,
      graceHours: 24,
      continuesAfterHold: false,
      sortOrder: 6,
      installmentRulesText: defaultRulesText("OTHER"),
    },
  ];
  for (const d of defaults) {
    await prisma.categoryDefault.upsert({
      where: { category: d.category },
      create: d,
      update: {
        installmentPlanMonths: d.installmentPlanMonths,
        cancelDeductionPercent: d.cancelDeductionPercent,
        graceHours: d.graceHours,
        continuesAfterHold: d.continuesAfterHold,
        installmentRulesText: d.installmentRulesText,
      },
    });
  }
}

async function notify(userId: string, title: string, body: string, type = "INFO", link?: string) {
  try {
    await prisma.notification.create({ data: { userId, title, body, type, link } });
  } catch (e) {
    console.error("notify failed", e);
  }
}

export async function runMaintenance() {
  const now = new Date();

  const expired = await prisma.reservation.findMany({
    where: { status: "PENDING", expiresAt: { lt: now }, amountPaid: 0 },
    include: { asset: true },
  });
  for (const r of expired) {
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({ where: { id: r.id }, data: { status: "EXPIRED" } });
      await tx.payment.updateMany({
        where: { reservationId: r.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      const other = await tx.reservation.findFirst({
        where: {
          assetId: r.assetId,
          id: { not: r.id },
          status: { in: ["PENDING", "CONFIRMED", "INSTALLMENT_PLAN", "PARTIALLY_PAID"] },
        },
      });
      if (!other) {
        await tx.asset.update({ where: { id: r.assetId }, data: { status: "AVAILABLE" } });
      }
    });
    await notify(
      r.userId,
      "Reservation expired",
      `Hold on "${r.asset.title}" expired with no payment.`,
      "RESERVATION",
      "/dashboard"
    );
  }

  const twelveHoursAgo = new Date(now.getTime() - 12 * 3600 * 1000);
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
        verificationStatus:
          u.verificationStatus === "PENDING" ? "UNDER_REVIEW" : u.verificationStatus,
      },
    });
    await notify(
      u.id,
      "Account auto-approved",
      "You can use the platform. Final document verification may still be pending.",
      "VERIFICATION",
      "/dashboard"
    );
  }

  return {
    expiredReservations: expired.length,
    autoApprovedUsers: pendingUsers.length,
  };
}
