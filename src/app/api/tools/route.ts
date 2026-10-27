import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApproved } from "@/lib/auth";
import { RESERVATION_PAYMENT_HOURS, runMaintenance } from "@/lib/maintenance";

export async function GET(req: NextRequest) {
  try {
    await runMaintenance();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const tools = await prisma.tool.findMany({
      where: {
        ...(category ? { category } : {}),
        available: { gt: 0 },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(tools);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch tools" }, { status: 500 });
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
        { error: msg === "Account pending approval" ? msg : "Please login to rent tools" },
        { status: msg === "Account pending approval" ? 403 : 401 }
      );
    }

    const body = await req.json();
    const { toolId, quantity, startDate, endDate, confirmed } = body;

    if (!toolId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Tool, start and end dates required" },
        { status: 400 }
      );
    }
    if (!confirmed) {
      return NextResponse.json(
        { error: "Please confirm the rental details before booking" },
        { status: 400 }
      );
    }

    const tool = await prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.available < (quantity || 1)) {
      return NextResponse.json(
        { error: "Tool not available in requested quantity" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    );
    const qty = quantity || 1;
    const totalCost =
      days >= 7
        ? Math.ceil(days / 7) * tool.weeklyRate * qty
        : days * tool.dailyRate * qty;

    const expiresAt = new Date(
      Date.now() + RESERVATION_PAYMENT_HOURS * 60 * 60 * 1000
    );

    const rental = await prisma.$transaction(async (tx) => {
      // Remove from available inventory
      await tx.tool.update({
        where: { id: toolId },
        data: { available: { decrement: qty } },
      });

      return tx.toolRental.create({
        data: {
          userId: session.id,
          toolId,
          quantity: qty,
          startDate: start,
          endDate: end,
          totalCost,
          status: "PENDING",
          expiresAt,
        },
        include: { tool: true },
      });
    });

    await prisma.payment.create({
      data: {
        userId: session.id,
        amount: totalCost,
        type: "RENTAL",
        method: "PENDING",
        status: "PENDING",
        toolRentalId: rental.id,
        referenceId: rental.id,
      },
    });

    return NextResponse.json(
      {
        ...rental,
        message: `Rental held for ${RESERVATION_PAYMENT_HOURS}h. Pay before then or it is cancelled and stock restored.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Rental failed" }, { status: 500 });
  }
}
