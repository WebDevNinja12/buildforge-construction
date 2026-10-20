import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const tools = await prisma.tool.findMany({
      where: category ? { category } : undefined,
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
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Please login to rent tools" }, { status: 401 });
    }

    const body = await req.json();
    const { toolId, quantity, startDate, endDate } = body;

    if (!toolId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Tool, start and end dates required" },
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

    const rental = await prisma.$transaction(async (tx) => {
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

    return NextResponse.json(rental, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Rental failed" }, { status: 500 });
  }
}
