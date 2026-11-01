import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminFromEnv, DEFAULT_ADMIN_EMAIL } from "@/lib/auth";

/**
 * POST /api/setup/seed
 * Runs category defaults + ensures admin account.
 * Optional header: x-setup-secret matching SETUP_SECRET env (if set).
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.SETUP_SECRET;
    if (secret) {
      const given = req.headers.get("x-setup-secret") || "";
      if (given !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const cats = [
      { category: "HOUSE", name: "House / Building", defaultExpiryHours: 14 * 24, installmentPlanMonths: 6, cancelDeductionPercent: 10, graceHours: 24, continuesAfterHold: true },
      { category: "HOTEL", name: "Hotel", defaultExpiryHours: 7 * 24, installmentPlanMonths: null, cancelDeductionPercent: 20, graceHours: 24, continuesAfterHold: false },
      { category: "LAND", name: "Land", defaultExpiryHours: 5 * 24, installmentPlanMonths: 12, cancelDeductionPercent: 10, graceHours: 24, continuesAfterHold: true },
      { category: "APARTMENT", name: "Apartment", defaultExpiryHours: 14 * 24, installmentPlanMonths: 6, cancelDeductionPercent: 10, graceHours: 24, continuesAfterHold: true },
      { category: "TOOLS", name: "Tools", defaultExpiryHours: 48, installmentPlanMonths: null, cancelDeductionPercent: 15, graceHours: 12, continuesAfterHold: false },
      { category: "WORKERS", name: "Workers", defaultExpiryHours: 12, installmentPlanMonths: null, cancelDeductionPercent: 15, graceHours: 6, continuesAfterHold: false },
      { category: "OTHER", name: "Other", defaultExpiryHours: 72, installmentPlanMonths: null, cancelDeductionPercent: 15, graceHours: 24, continuesAfterHold: false },
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

    await ensureAdminFromEnv();

    const admin = await prisma.user.findUnique({
      where: { email: (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).toLowerCase() },
      select: { id: true, email: true, role: true, status: true },
    });

    const catCount = await prisma.categoryDefault.count();

    return NextResponse.json({
      ok: true,
      categories: catCount,
      admin: admin ? { email: admin.email, role: admin.role, status: admin.status } : null,
      message: "Seed applied",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    hint: "POST to this endpoint to seed category defaults and ensure admin",
    defaultAdminEmail: DEFAULT_ADMIN_EMAIL,
  });
}
