import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApproved } from "@/lib/auth";
import { RESERVATION_PAYMENT_HOURS, runMaintenance } from "@/lib/maintenance";

export async function GET(req: NextRequest) {
  try {
    await runMaintenance();
    const { searchParams } = new URL(req.url);
    const specialty = searchParams.get("specialty");

    const workers = await prisma.worker.findMany({
      where: {
        available: true,
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
    await runMaintenance();
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

    const expiresAt = new Date(
      Date.now() + RESERVATION_PAYMENT_HOURS * 60 * 60 * 1000
    );

    // If a specific worker is chosen, mark unavailable until hire completes/expires
    if (workerId) {
      const worker = await prisma.worker.findUnique({ where: { id: workerId } });
      if (!worker || !worker.available) {
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
        message: "Hire request submitted. Review details were confirmed by you before booking.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Hire request failed" }, { status: 500 });
  }
}
