import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApproved } from "@/lib/auth";
import { getExpiryHours, runMaintenance } from "@/lib/maintenance";

export async function GET(req: NextRequest) {
  try {
    await runMaintenance().catch(() => null);
    const { searchParams } = new URL(req.url);
    const specialty = searchParams.get("specialty");
    const all = searchParams.get("all") === "1";

    const workers = await prisma.worker.findMany({
      where: {
        active: true,
        ...(all ? {} : { available: true }),
        ...(specialty ? { specialty } : {}),
      },
      orderBy: { rating: "desc" },
    });

    return NextResponse.json(workers);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch workers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await runMaintenance().catch(() => null);
    let session;
    try {
      session = await requireApproved();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unauthorized";
      return NextResponse.json(
        { error: msg === "Account pending approval" ? msg : "Please login to hire" },
        { status: msg === "Account pending approval" ? 403 : 401 }
      );
    }

    const body = await req.json();
    const {
      workerId,
      serviceType,
      description,
      location,
      startDate,
      endDate,
      estimatedCost,
      confirmed,
    } = body;

    if (!description || !location || !startDate) {
      return NextResponse.json(
        { error: "Description, location and start date required" },
        { status: 400 }
      );
    }
    if (!confirmed) {
      return NextResponse.json(
        { error: "Please confirm the hire details before submitting" },
        { status: 400 }
      );
    }

    const hours = await getExpiryHours("WORKERS", null);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    if (workerId) {
      const worker = await prisma.worker.findUnique({ where: { id: workerId } });
      if (!worker || !worker.available || !worker.active) {
        return NextResponse.json({ error: "Worker not available" }, { status: 400 });
      }
    }

    const hire = await prisma.$transaction(async (tx) => {
      if (workerId) {
        await tx.worker.update({
          where: { id: workerId },
          data: { available: false },
        });
      }
      return tx.hireRequest.create({
        data: {
          userId: session.id,
          workerId: workerId || null,
          serviceType: serviceType || "LABOR",
          description,
          location,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          estimatedCost: estimatedCost || null,
          status: "PENDING",
          expiresAt,
        },
        include: { worker: true },
      });
    });

    if (estimatedCost) {
      await prisma.payment.create({
        data: {
          userId: session.id,
          amount: estimatedCost,
          type: "HIRE",
          method: "PENDING",
          status: "PENDING",
          hireRequestId: hire.id,
          referenceId: hire.id,
        },
      });
    }

    return NextResponse.json(
      {
        ...hire,
        message: "Hire request submitted.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Hire request failed" }, { status: 500 });
  }
}
