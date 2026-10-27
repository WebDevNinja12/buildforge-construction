/**
 * Production seed — NO demo users, listings, or passwords.
 *
 * Creates only:
 * - Category default rules (installment / expiry)
 * - Optional first admin from env:
 *     ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 *
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Production seed: category defaults only...");

  const cats = [
    {
      category: "HOUSE",
      name: "House / Building",
      defaultExpiryHours: 14 * 24,
      installmentPlanMonths: 6,
      cancelDeductionPercent: 0,
      graceHours: 24,
      continuesAfterHold: true,
      sortOrder: 1,
      installmentRulesText:
        "Installment continues after the reservation hold. Pay the first deposit before the hold expires. The installment plan deadline is set by the company (e.g. 6 months).",
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
      installmentRulesText:
        "Installments must be completed within the reservation period. Unpaid balance after the period triggers a grace window, then cancellation with a deduction on any refund.",
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
      installmentRulesText:
        "Installment continues after the hold. Plan duration is set by the company (e.g. up to 12 months after first deposit).",
    },
    {
      category: "APARTMENT",
      name: "Apartment",
      defaultExpiryHours: 14 * 24,
      installmentPlanMonths: 6,
      cancelDeductionPercent: 0,
      graceHours: 24,
      continuesAfterHold: true,
      sortOrder: 4,
      installmentRulesText:
        "Same as house/building: deposit before hold ends, then longer installment plan.",
    },
    {
      category: "TOOLS",
      name: "Tools",
      defaultExpiryHours: 48,
      installmentPlanMonths: null,
      cancelDeductionPercent: 15,
      graceHours: 12,
      continuesAfterHold: false,
      sortOrder: 5,
      installmentRulesText:
        "Must complete payment within the reservation period. Grace then refund minus cancellation deduction.",
    },
    {
      category: "WORKERS",
      name: "Workers",
      defaultExpiryHours: 12,
      installmentPlanMonths: null,
      cancelDeductionPercent: 10,
      graceHours: 6,
      continuesAfterHold: false,
      sortOrder: 6,
      installmentRulesText:
        "Must complete payment within the reservation period. Grace then refund minus cancellation deduction.",
    },
    {
      category: "OTHER",
      name: "Other Construction",
      defaultExpiryHours: 24,
      installmentPlanMonths: null,
      cancelDeductionPercent: 10,
      graceHours: 24,
      continuesAfterHold: false,
      sortOrder: 7,
      installmentRulesText: "Follow the rules shown at booking for this service category.",
    },
  ];

  for (const c of cats) {
    await prisma.categoryDefault.upsert({
      where: { category: c.category },
      create: c,
      update: {
        name: c.name,
        defaultExpiryHours: c.defaultExpiryHours,
        installmentPlanMonths: c.installmentPlanMonths,
        cancelDeductionPercent: c.cancelDeductionPercent,
        graceHours: c.graceHours,
        continuesAfterHold: c.continuesAfterHold,
        installmentRulesText: c.installmentRulesText,
        sortOrder: c.sortOrder,
      },
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME?.trim() || "Administrator";

  if (adminEmail && adminPassword && adminPassword.length >= 8) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        password: hash,
        name: adminName,
        role: "ADMIN",
        status: "APPROVED",
        verificationStatus: "VERIFIED",
        approvedAt: new Date(),
        verifiedAt: new Date(),
      },
      create: {
        email: adminEmail,
        password: hash,
        name: adminName,
        role: "ADMIN",
        status: "APPROVED",
        verificationStatus: "VERIFIED",
        approvedAt: new Date(),
        verifiedAt: new Date(),
        agreedTermsAt: new Date(),
      },
    });
    console.log(`Admin ready: ${adminEmail}`);
  } else {
    console.log(
      "No ADMIN_EMAIL / ADMIN_PASSWORD set — create the first admin via POST /api/setup/admin"
    );
  }

  console.log("Seed complete (no demo listings or demo clients).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
