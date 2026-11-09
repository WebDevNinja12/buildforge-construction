import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureAdminFromEnv, DEFAULT_ADMIN_EMAIL, getSession } from "@/lib/auth";

/**
 * POST /api/setup/seed
 * Runs category defaults + ensures admin account.
 * Auth: logged-in ADMIN session, or x-setup-secret matching SETUP_SECRET.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.SETUP_SECRET;
    const given = req.headers.get("x-setup-secret") || "";
    const session = await getSession().catch(() => null);
    const isAdmin = session && String(session.role || "").toUpperCase() === "ADMIN";
    if (secret) {
      if (given !== secret && !isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else if (!isAdmin) {
      return NextResponse.json({ error: "Admin login required to seed" }, { status: 401 });
    }

    const cats = [
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

    const admin = await ensureAdminFromEnv();
    const catCount = await prisma.categoryDefault.count();

    return NextResponse.json({
      ok: true,
      message: `Seed complete. ${catCount} categories. Admin: ${admin?.email || DEFAULT_ADMIN_EMAIL}`,
      categories: catCount,
      admin: admin?.email || DEFAULT_ADMIN_EMAIL,
    });
  } catch (e) {
    console.error("seed", e);
    return NextResponse.json(
      { error: "Seed failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    hint: "POST as logged-in admin (or with x-setup-secret) to seed category defaults and ensure admin",
  });
}
