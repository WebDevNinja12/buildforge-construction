/**
 * Production seed — category defaults + admin account.
 *
 * Env overrides:
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 *
 * Defaults:
 *   hamaconstruction01@gmail.com / HamaAdmin2026!
 *
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "hamaconstruction01@gmail.com";
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
    },
    {
      category: "HOTEL",
      name: "Hotel",
      defaultExpiryHours: 7 * 24,
      installmentPlanMonths: null,
      cancelDeductionPercent: 20,
      graceHours: 24,
      continuesAfterHold: false,
    },
    {
      category: "LAND",
      name: "Land",
      defaultExpiryHours: 5 * 24,
      installmentPlanMonths: 12,
      cancelDeductionPercent: 10,
      graceHours: 24,
      continuesAfterHold: true,
    },
    {
      category: "APARTMENT",
      name: "Apartment",
      defaultExpiryHours: 14 * 24,
      installmentPlanMonths: 6,
      cancelDeductionPercent: 10,
      graceHours: 24,
      continuesAfterHold: true,
    },
    {
      category: "TOOLS",
      name: "Tools",
      defaultExpiryHours: 48,
      installmentPlanMonths: null,
      cancelDeductionPercent: 15,
      graceHours: 12,
      continuesAfterHold: false,
    },
    {
      category: "WORKERS",
      name: "Workers",
      defaultExpiryHours: 12,
      installmentPlanMonths: null,
      cancelDeductionPercent: 15,
      graceHours: 6,
      continuesAfterHold: false,
    },
    {
      category: "OTHER",
      name: "Other Construction Activities",
      defaultExpiryHours: 24,
      installmentPlanMonths: null,
      cancelDeductionPercent: 10,
      graceHours: 12,
      continuesAfterHold: false,
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
      },
      create: {
        category: c.category,
        name: c.name,
        defaultExpiryHours: c.defaultExpiryHours,
        installmentPlanMonths: c.installmentPlanMonths,
        cancelDeductionPercent: c.cancelDeductionPercent,
        graceHours: c.graceHours,
        continuesAfterHold: c.continuesAfterHold,
      },
    });
  }

  const adminEmail = (process.env.ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL).toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME?.trim() || "Hama Admin";
  const hashed = await bcrypt.hash(adminPassword, 12);

  for (const legacy of ["admin@hamaconstruction.com", "admin@buildforge.com"]) {
    if (legacy === adminEmail) continue;
    const old = await prisma.user.findUnique({ where: { email: legacy } });
    if (old) {
      try {
        await prisma.user.update({
          where: { id: old.id },
          data: {
            email: adminEmail,
            password: hashed,
            name: adminName,
            role: "ADMIN",
            status: "APPROVED",
            verificationStatus: "VERIFIED",
          },
        });
        console.log("Migrated legacy admin", legacy, "->", adminEmail);
      } catch {
        /* */
      }
    }
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashed,
      name: adminName,
      role: "ADMIN",
      status: "APPROVED",
      verificationStatus: "VERIFIED",
    },
    create: {
      email: adminEmail,
      password: hashed,
      name: adminName,
      role: "ADMIN",
      status: "APPROVED",
      verificationStatus: "VERIFIED",
      agreedTermsAt: new Date(),
      approvedAt: new Date(),
      verifiedAt: new Date(),
    },
  });

  console.log("Admin ready:", adminEmail);
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
