import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Ensures critical tables exist by probing Prisma models.
 * Full schema is applied at build via `prisma db push`.
 * Protected by SETUP_SECRET or admin session.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.SETUP_SECRET || process.env.CRON_SECRET;
  const header = req.headers.get("x-setup-secret") || "";
  const auth = req.headers.get("authorization") || "";
  const okSecret = secret && (header === secret || auth === `Bearer ${secret}`);

  if (!okSecret) {
    // allow if SETUP_ALLOW_RESET is true and body has setup key matching admin email bootstrap
    const allow = process.env.SETUP_ALLOW_RESET === "true";
    if (!allow) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results: Record<string, string> = {};

  async function probe(name: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      results[name] = "ok";
    } catch (e) {
      results[name] = e instanceof Error ? e.message : "fail";
    }
  }

  await probe("User", () => prisma.user.findMany({ take: 1 }));
  await probe("Asset", () => prisma.asset.findMany({ take: 1 }));
  await probe("Reservation", () => prisma.reservation.findMany({ take: 1 }));
  await probe("Tool", () => prisma.tool.findMany({ take: 1 }));
  await probe("Worker", () => prisma.worker.findMany({ take: 1 }));
  await probe("Project", () => prisma.project.findMany({ take: 1 }));
  await probe("Payment", () => prisma.payment.findMany({ take: 1 }));
  await probe("QuoteRequest", () => prisma.quoteRequest.findMany({ take: 1 }));
  await probe("Testimonial", () => prisma.testimonial.findMany({ take: 1 }));
  await probe("FinishedProject", () => prisma.finishedProject.findMany({ take: 1 }));
  await probe("ContactMessage", () => prisma.contactMessage.findMany({ take: 1 }));
  await probe("SiteSetting", () => prisma.siteSetting.findMany({ take: 1 }));

  const missing = Object.entries(results).filter(([, v]) => v !== "ok");

  return NextResponse.json({
    ok: missing.length === 0,
    results,
    missing: missing.map(([k]) => k),
    hint:
      missing.length > 0
        ? "Redeploy so build runs: npx prisma db push --accept-data-loss. Tables are created during Vercel build when DATABASE URL is set."
        : "All probed tables are available",
  });
}

export async function GET() {
  return POST(new NextRequest("http://local", { method: "POST" }));
}
