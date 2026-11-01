/**
 * Production seed — category defaults + admin account.
 *
 * Env overrides:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 *
 * Defaults:
 *   admin@hamaconstruction.com / HamaAdmin2026!
 *
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "admin@hamaconstruction.com";
const DEFAULT_ADMIN_PASSWORD = "HamaAdmin2026!";

async function main() {
  console.log("Seed: category defaults + admin...");

  const cats = [
    {
      category: "HOUSE",
      name: "House / Building",
      defaultExpiryHours: 14 * 24,
      installmentPlanMonths: 6,
      cancelDeductionPercent: 10,
      graceHours: 24,
      continuesAfterHold: true,
      installmentRulesText:
        "Installment continues after the reservation hold. Pay the first deposit before the hold expires.",
    },
    {
      category: "HOTEL",
      name: "Hotel",
      defaultExpiryHours: 7 * 24,
      installmentPlanMonths: null,
      cancelDeductionPercent: 20,
      graceHours: 24,
      continuesAfterHold: false,
      installmentRulesText:
        "Installments must be completed within the reservation period.",
    },
    {
      category: "LAND",
      name: "Land",
      defaultExpiryHours: 5 * 24,
      installmentPlanMonths: 12,
      cancelDeductionPercent: 10,
      graceHours: 24,
      continuesAfterHold: true,
      installmentRulesText:
        "Installment continues after the hold. Plan duration is set by the company.",
    },
    {
      category: "APARTMENT",
      name: "Apartment",
      defaultExpiryHours: 14 * 24,
      installmentPlanMonths: 6,
      cancelDeductionPercent: 10,
      graceHours: 24,
      continuesAfterHold: true,
      installmentRulesText: "Same as house/building installment rules.",
    },
    {
      category: "TOOLS",
      name: "Tools",
      defaultExpiryHours: 48,
      installmentPlanMonths: null,
      cancelDeductionPercent: 15,
      graceHours: 12,
      continuesAfterHold: false,
      installmentRulesText: "Complete payment within the reservation period.",
    },
    {
      category: "WORKERS",
      name: "Workers",
      defaultExpiryHours: 12,
      installmentPlanMonths: null,
      cancelDeductionPercent: 15,
      graceHours: 6,
      continuesAfterHold: false,
      installmentRulesText: "Short hold; pay promptly to confirm hire.",
    },
    {
      category: "OTHER",
      name: "Other Construction Activities",
      defaultExpiryHours: 72,
      installmentPlanMonths: null,
      cancelDeductionPercent: 15,
      graceHours: 24,
      continuesAfterHold: false,
      installmentRulesText: "Follow the terms shown at reservation.",
    },
  ];

  for (const c of cats) {
    await prisma.categoryDefault.upsert({
      where: { category: c.category },
      update: {
        name: c.name,
        defaultExpiryHours: c.defaultExpiryHours,
        installmentPlanMonths: c.installmentPlanMonths,
        cancelDeductionPercent: c.cancelDeductionPercent,
        graceHours: c.graceHours,
        continuesAfterHold: c.continuesAfterHold,
        installmentRulesText: c.installmentRulesText,
      },
      create: {
        category: c.category,
        name: c.name,
        defaultExpiryHours: c.defaultExpiryHours,
        installmentPlanMonths: c.installmentPlanMonths,
        cancelDeductionPercent: c.cancelDeductionPercent,
        graceHours: c.graceHours,
        continuesAfterHold: c.continuesAfterHold,
        installmentRulesText: c.installmentRulesText,
      },
    });
  }

  const adminEmail = (
    process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL
  ).toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME?.trim() || "Hama Admin";

  if (adminPassword.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const hash = await bcrypt.hash(adminPassword, 12);

  // Migrate old default email if needed
  const legacy = await prisma.user.findUnique({
    where: { email: "admin@buildforge.com" },
  });
  if (legacy && adminEmail !== "admin@buildforge.com") {
    const taken = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!taken) {
      await prisma.user.update({
        where: { id: legacy.id },
        data: {
          email: adminEmail,
          password: hash,
          name: adminName,
          role: "ADMIN",
          status: "APPROVED",
          verificationStatus: "VERIFIED",
        },
      });
      console.log(`Migrated admin → ${adminEmail}`);
    }
  }

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
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
