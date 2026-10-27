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
    const row = await prisma.categoryDefault.findUnique({
      where: { category },
      include: { requiredDocs: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
    });
    if (row) return row;
  } catch { /* */ }
  return {
    category,
    name: category,
    defaultExpiryHours: DEFAULT_HOURS[category] ?? 24,
    installmentPlanMonths: ["HOUSE", "LAND", "APARTMENT"].includes(category) ? (category === "LAND" ? 12 : 6) : null,
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
    "If still unpaid, the reservation is cancelled and you are refunded minus a cancellation deduction " +
    "that covers the cost of holding the service."
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

  // 1. Expire unpaid PENDING holds (no deposit paid)
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
      `Hold on "${r.asset.title}" expired with no payment. Listing is available again.`,
      "RESERVATION",
      "/dashboard"
    );
  }

  // 2. In-period categories: start grace when reservation expires with balance
  const overdueInPeriod = await prisma.reservation.findMany({
    where: {
      status: { in: ["INSTALLMENT_PLAN", "PARTIALLY_PAID", "CONFIRMED"] },
      paymentMethod: "INSTALLMENT",
      expiresAt: { lt: now },
      graceEndsAt: null,
      amountPaid: { gt: 0 },
    },
    include: { asset: true },
  });
  for (const r of overdueInPeriod) {
    const cfg = await getCategoryConfig(r.asset.type);
    if (cfg.continuesAfterHold) continue; // House/Land use planDeadline instead
    const graceHours = cfg.graceHours ?? 24;
    const graceEnds = new Date(now.getTime() + graceHours * 3600 * 1000);
    const total = r.totalAmount || r.deposit;
    const paid = r.amountPaid || 0;
    const deduction = cfg.cancelDeductionPercent ?? 10;
    const refund = Math.max(0, Math.round((paid - (paid * deduction) / 100) * 100) / 100);
    await prisma.reservation.update({
      where: { id: r.id },
      data: {
        graceEndsAt: graceEnds,
        deductionPercent: deduction,
        refundAmount: refund,
        graceNotified: true,
      },
    });
    await notify(
      r.userId,
      "Grace period started",
      `Reservation period for "${r.asset.title}" ended with balance unpaid. ` +
        `Complete payment within ${graceHours} hours or receive a refund of about $${refund} ` +
        `(${deduction}% cancellation deduction).`,
      "PAYMENT",
      "/dashboard"
    );
  }

  // 3. End of grace → cancel + refund record
  const graceEnded = await prisma.reservation.findMany({
    where: {
      graceEndsAt: { lt: now },
      status: { in: ["INSTALLMENT_PLAN", "PARTIALLY_PAID", "CONFIRMED"] },
    },
    include: { asset: true },
  });
  for (const r of graceEnded) {
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: r.id },
        data: {
          status: "REFUNDED",
          cancelReason: `Grace ended. Deduction ${r.deductionPercent}% applied.`,
        },
      });
      await tx.asset.update({ where: { id: r.assetId }, data: { status: "AVAILABLE" } });
      await tx.adminActivityLog.create({
        data: {
          adminId: r.userId, // system; will fix if admin required - use first admin if needed
          action: "AUTO_REFUND",
          entity: "Reservation",
          entityId: r.id,
          details: `refund=${r.refundAmount} deduction=${r.deductionPercent}%`,
        },
      }).catch(() => null);
    });
    await notify(
      r.userId,
      "Reservation cancelled — refund processed",
      `"${r.asset.title}" cancelled after grace. Estimated refund: $${r.refundAmount ?? 0} (after deduction).`,
      "PAYMENT",
      "/dashboard"
    );
  }

  // 4. Reminders 24h / 1h before reservation expiry
  const in25h = new Date(now.getTime() + 25 * 3600 * 1000);
  const in23h = new Date(now.getTime() + 23 * 3600 * 1000);
  const soon24 = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      reminder24hSent: false,
      expiresAt: { gte: in23h, lte: in25h },
    },
    include: { asset: true },
  });
  for (const r of soon24) {
    await prisma.reservation.update({ where: { id: r.id }, data: { reminder24hSent: true } });
    await notify(r.userId, "Payment due in ~24 hours", `Pay for "${r.asset.title}" within 24 hours.`, "RESERVATION", "/dashboard");
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
    await prisma.reservation.update({ where: { id: r.id }, data: { reminder1hSent: true } });
    await notify(r.userId, "Payment due in about 1 hour", `Last chance for "${r.asset.title}".`, "RESERVATION", "/dashboard");
  }

  // 5. Plan deadline reminders (House/Land)
  const planSoon = await prisma.reservation.findMany({
    where: {
      status: { in: ["INSTALLMENT_PLAN", "PARTIALLY_PAID"] },
      planDeadline: { gte: in23h, lte: in25h },
      planReminderSent: false,
    },
    include: { asset: true },
  });
  for (const r of planSoon) {
    await prisma.reservation.update({ where: { id: r.id }, data: { planReminderSent: true } });
    await notify(
      r.userId,
      "Installment plan ending soon",
      `Plan deadline for "${r.asset.title}" is within 24 hours. Balance remaining.`,
      "PAYMENT",
      "/dashboard"
    );
  }

  // 6. Auto-approve clients after 12h
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
        verificationStatus: u.verificationStatus === "PENDING" ? "UNDER_REVIEW" : u.verificationStatus,
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
    graceStarted: overdueInPeriod.length,
    refunded: graceEnded.length,
    reminders24h: soon24.length,
    reminders1h: soon1h.length,
    autoApprovedUsers: pendingUsers.length,
  };
}
