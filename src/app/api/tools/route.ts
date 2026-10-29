import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApproved } from "@/lib/auth";
import { getExpiryHours, runMaintenance } from "@/lib/maintenance";

export async function GET(req: NextRequest) {
  try {
    await runMaintenance().catch(() => null);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const tools = await prisma.tool.findMany({
      where: {
        active: true,
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

/** Reserve tool first — payment on dashboard */
export async function POST(req: NextRequest) {
  try {
    await runMaintenance().catch(() => null);
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
      return NextResponse.json({ error: "Tool, start and end dates required" }, { status: 400 });
    }
    if (!confirmed) {
      return NextResponse.json({ error: "Confirm details after preview" }, { status: 400 });
    }

    const tool = await prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.available < (quantity || 1) || tool.active === false) {
      return NextResponse.json({ error: "Tool not available" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!(end > start)) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    const days = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    );
    const qty = quantity || 1;
    const totalCost =
      days >= 7
        ? Math.ceil(days / 7) * tool.weeklyRate * qty
        : days * tool.dailyRate * qty;

    const hours = await getExpiryHours("TOOLS", tool.reservationHours);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

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
          paymentMethod: "UNSET",
          expiresAt,
        },
        include: { tool: true },
      });
    });

    await prisma.notification.create({
      data: {
        userId: session.id,
        title: "Tool reserved",
        body: `"${tool.name}" reserved. Open Dashboard to pay before the hold expires (${hours}h).`,
        type: "RESERVATION",
        link: "/dashboard",
      },
    });

    return NextResponse.json(
      {
        ...rental,
        message: `Tool reserved. Pay from Dashboard within ${hours} hours.`,
        nextStep: "/dashboard",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Rental failed" }, { status: 500 });
  }
}
