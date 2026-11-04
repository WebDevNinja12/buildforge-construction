import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getExpiryHours, runMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await runMaintenance().catch(() => null);
    // Schema has active only (no available column)
    const workers = await prisma.worker.findMany({
      where: { active: true },
      orderBy: { rating: "desc" },
    });
    return NextResponse.json(workers);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch workers" }, { status: 500 });
  }
}

/** Hire = reserve first; pay on dashboard */
export async function POST(req: NextRequest) {
  try {
    await runMaintenance().catch(() => null);

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Please login to hire" }, { status: 401 });
    }
    const st = (session.status || "").toUpperCase();
    if (["REJECTED", "SUSPENDED", "ARCHIVED"].includes(st)) {
      return NextResponse.json({ error: "Account not allowed" }, { status: 403 });
    }
    if (st === "PENDING_APPROVAL" || st === "PENDING") {
      return NextResponse.json({ error: "Account pending approval" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const workerId = String(body.workerId || "").trim();
    const description = String(body.description || "").trim();
    const location = String(body.location || "").trim();
    const startDate = body.startDate;
    const endDate = body.endDate;
    const confirmed = body.confirmed === true || body.confirmed === "true";
    const estimatedCost = body.estimatedCost;

    if (!workerId) {
      return NextResponse.json({ error: "Select a worker" }, { status: 400 });
    }
    if (!description || !location || !startDate) {
      return NextResponse.json(
        { error: "Description, location and start date required" },
        { status: 400 }
      );
    }
    if (!confirmed) {
      return NextResponse.json(
        { error: "Confirm after reviewing worker details" },
        { status: 400 }
      );
    }

    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker || worker.active === false) {
      return NextResponse.json({ error: "Worker not available" }, { status: 400 });
    }

    // Block if already has an open hire
    const open = await prisma.hireRequest.findFirst({
      where: {
        workerId,
        status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
      },
    });
    if (open) {
      return NextResponse.json(
        { error: "This worker is already reserved by another request" },
        { status: 400 }
      );
    }

    const hours = await getExpiryHours("WORKERS", null);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const total =
      estimatedCost != null && Number.isFinite(Number(estimatedCost))
        ? Number(estimatedCost)
        : worker.dailyRate;

    const hire = await prisma.$transaction(async (tx) => {
      // Soft-hold: deactivate so they drop off public list until released
      await tx.worker.update({
        where: { id: workerId },
        data: { active: false },
      });
      return tx.hireRequest.create({
        data: {
          userId: session.id,
          workerId,
          status: "PENDING",
          location,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          expiresAt,
          notes: description.slice(0, 1000),
          total,
        },
        include: { worker: true },
      });
    });

    try {
      await prisma.notification.create({
        data: {
          userId: session.id,
          title: "Hire request reserved",
          body: `Hold on ${worker.name}. Open Dashboard to pay within ${hours} hours.`,
          type: "RESERVATION",
          link: "/dashboard",
        },
      });
    } catch {
      /* */
    }

    return NextResponse.json(
      {
        ...hire,
        message: `Reserved. Pay from Dashboard within ${hours} hours.`,
        nextStep: "/dashboard",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("workers POST", error);
    return NextResponse.json(
      {
        error: "Hire failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
