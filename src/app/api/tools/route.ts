import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getExpiryHours, runMaintenance } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await runMaintenance().catch(() => null);
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const tools = await prisma.tool.findMany({
      where: {
        active: true,
        available: { gt: 0 },
        ...(category ? { category } : {}),
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

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Please login to rent tools" }, { status: 401 });
    }
    const st = (session.status || "").toUpperCase();
    if (["REJECTED", "SUSPENDED", "ARCHIVED"].includes(st)) {
      return NextResponse.json({ error: "Account not allowed" }, { status: 403 });
    }
    if (st === "PENDING_APPROVAL" || st === "PENDING") {
      return NextResponse.json({ error: "Account pending approval" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const toolId = String(body.toolId || "").trim();
    const quantity = Math.max(1, Number(body.quantity) || 1);
    const startDate = body.startDate;
    const endDate = body.endDate;
    const confirmed = body.confirmed === true || body.confirmed === "true";

    if (!toolId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Tool, start and end dates required" },
        { status: 400 }
      );
    }
    if (!confirmed) {
      return NextResponse.json({ error: "Confirm details after preview" }, { status: 400 });
    }

    const tool = await prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.active === false || tool.available < quantity) {
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
    const total =
      days >= 7
        ? Math.ceil(days / 7) * tool.weeklyRate * quantity
        : days * tool.dailyRate * quantity;

    const hours = await getExpiryHours("TOOLS", null);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const rental = await prisma.$transaction(async (tx) => {
      const current = await tx.tool.findUnique({ where: { id: toolId } });
      if (!current || current.available < quantity) {
        throw new Error("Tool not available");
      }
      await tx.tool.update({
        where: { id: toolId },
        data: { available: { decrement: quantity } },
      });
      // Schema fields: total (not totalCost), no quantity/paymentMethod columns
      return tx.toolRental.create({
        data: {
          userId: session.id,
          toolId,
          startDate: start,
          endDate: end,
          total,
          status: "PENDING",
          expiresAt,
        },
        include: { tool: true },
      });
    });

    try {
      await prisma.notification.create({
        data: {
          userId: session.id,
          title: "Tool reserved",
          body: `"${tool.name}" reserved. Open Dashboard to pay before the hold expires (${hours}h).`,
          type: "RESERVATION",
          link: "/dashboard",
        },
      });
    } catch {
      /* */
    }

    return NextResponse.json(
      {
        ...rental,
        quantity,
        message: `Tool reserved. Pay from Dashboard within ${hours} hours.`,
        nextStep: "/dashboard",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("tools POST", error);
    const msg = error instanceof Error ? error.message : "Rental failed";
    if (msg === "Tool not available") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Rental failed", detail: msg }, { status: 500 });
  }
}
