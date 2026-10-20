import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Please login to hire" }, { status: 401 });
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
    } = body;

    if (!description || !location || !startDate) {
      return NextResponse.json(
        { error: "Description, location and start date required" },
        { status: 400 }
      );
    }

    const hire = await prisma.hireRequest.create({
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
      },
      include: { worker: true },
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

    return NextResponse.json(hire, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Hire request failed" }, { status: 500 });
  }
}
