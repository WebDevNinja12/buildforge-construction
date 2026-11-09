import { prisma } from "@/lib/prisma";

/** Fallback if CategoryDefault row missing */
const DEFAULT_HOURS: Record<string, number> = {
  HOUSE: 7 * 24,
  BUILDING: 7 * 24,
  APARTMENT: 7 * 24,
  LAND: 7 * 24,
  HOTEL: 60,
  COMMERCIAL: 60,
  TOOLS: 60,
  OTHER: 60,
  WORKERS: 12,
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
    if (row) return row;
  } catch {
    /* */
  }
  return {
    category,
    name: category,
    defaultExpiryHours: DEFAULT_HOURS[category] ?? 24,
    installmentPlanMonths: null as number | null,
    cancelDeductionPercent: 10,
    graceHours: 24,
    continuesAfterHold: false,
  };
}

export async function ensureCategoryDefaults() {
  const cats: Array<{
    category: string;
    name: string;
    defaultExpiryHours: number;
    installmentPlanMonths: number | null;
    cancelDeductionPercent: number;
    graceHours: number;
    continuesAfterHold: boolean;
  }> = [
    { category: "HOUSE", name: "House / Building", defaultExpiryHours: 7 * 24, installmentPlanMonths: 12, cancelDeductionPercent: 10, graceHours: 24, continuesAfterHold: true },
    { category: "BUILDING", name: "Building", defaultExpiryHours: 7 * 24, installmentPlanMonths: 12, cancelDeductionPercent: 10, graceHours: 24, continuesAfterHold: true },
    { category: "LAND", name: "Land", defaultExpiryHours: 7 * 24, installmentPlanMonths: 12, cancelDeductionPercent: 10, graceHours: 24, continuesAfterHold: true },
    { category: "APARTMENT", name: "Apartment", defaultExpiryHours: 7 * 24, installmentPlanMonths: 12, cancelDeductionPercent: 10, graceHours: 24, continuesAfterHold: true },
    { category: "HOTEL", name: "Hotel", defaultExpiryHours: 60, installmentPlanMonths: 6, cancelDeductionPercent: 10, graceHours: 24, continuesAfterHold: false },
    { category: "COMMERCIAL", name: "Commercial", defaultExpiryHours: 60, installmentPlanMonths: 6, cancelDeductionPercent: 10, graceHours: 24, continuesAfterHold: false },
    { category: "TOOLS", name: "Tools", defaultExpiryHours: 60, installmentPlanMonths: null, cancelDeductionPercent: 10, graceHours: 12, continuesAfterHold: false },
    { category: "WORKERS", name: "Workers", defaultExpiryHours: 12, installmentPlanMonths: null, cancelDeductionPercent: 10, graceHours: 6, continuesAfterHold: false },
    { category: "OTHER", name: "Other", defaultExpiryHours: 60, installmentPlanMonths: null, cancelDeductionPercent: 10, graceHours: 24, continuesAfterHold: false },
  ];
  for (const c of cats) {
    try {
      await prisma.categoryDefault.upsert({
        where: { category: c.category },
        update: {
          name: c.name,
          defaultExpiryHours: c.defaultExpiryHours,
          installmentPlanMonths: c.installmentPlanMonths,
          cancelDeductionPercent: c.cancelDeductionPercent,
          graceHours: c.graceHours,
          continuesAfterHold: c.continuesAfterHold,
        },
        create: { ...c },
      });
    } catch {
      /* */
    }
  }
}

export async function runMaintenance() {
  const now = new Date();
  const results: Record<string, number> = {};
  try {
    const expired = await prisma.reservation.updateMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        expiresAt: { lt: now },
        paymentType: { not: "INSTALLMENT" },
      },
      data: { status: "EXPIRED" },
    });
    results.expiredReservations = expired.count;
  } catch (e) {
    console.error("maintenance expire reservations", e);
  }
  try {
    const free = await prisma.asset.updateMany({
      where: {
        status: { in: ["RESERVED", "HELD"] },
        reservations: {
          none: { status: { in: ["PENDING", "CONFIRMED", "INSTALLMENT_PLAN", "PARTIALLY_PAID"] } },
        },
      },
      data: { status: "AVAILABLE" },
    });
    results.freedAssets = free.count;
  } catch (e) {
    console.error("maintenance free assets", e);
  }
  try {
    const tools = await prisma.toolRental.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    });
    results.expiredToolRentals = tools.count;
  } catch (e) {
    console.error("maintenance tool rentals", e);
  }
  try {
    const hires = await prisma.hireRequest.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    });
    results.expiredHires = hires.count;
  } catch (e) {
    console.error("maintenance hires", e);
  }
  try {
    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const auto = await prisma.user.updateMany({
      where: { role: "CLIENT", status: "PENDING_APPROVAL", createdAt: { lte: cutoff } },
      data: { status: "ACTIVE" },
    });
    results.autoApproved = auto.count;
  } catch (e) {
    console.error("maintenance auto-approve", e);
  }
  return results;
}
