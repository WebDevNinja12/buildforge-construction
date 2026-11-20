import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { healSchema } from "@/lib/schema-heal";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

function imagesJson(body: Record<string, unknown>) {
  if (Array.isArray(body.images)) return JSON.stringify(body.images.filter(Boolean));
  if (body.image) return JSON.stringify([String(body.image)]);
  if (body.imageUrl) return JSON.stringify([String(body.imageUrl)]);
  return null;
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  await healSchema().catch(() => null);
  try {
    const returnsOnly = new URL(req.url).searchParams.get("returns") === "1";
    if (returnsOnly) {
      const rentals = await prisma.toolRental.findMany({
        where: {
          status: { in: ["CONFIRMED", "ACTIVE", "PAID", "OVERDUE"] },
        },
        include: {
          tool: true,
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
      return NextResponse.json({ rentals });
    }

    let tools: unknown[] = [];
    try {
      tools = await prisma.tool.findMany({ orderBy: { name: "asc" } });
    } catch (e) {
      console.error("admin tools findMany", e);
      try {
        tools = await prisma.$queryRawUnsafe(`SELECT * FROM "Tool" ORDER BY name ASC`);
      } catch {
        tools = [];
      }
    }
    return NextResponse.json(Array.isArray(tools) ? tools : []);
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to load tools", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  await healSchema().catch(() => null);
  try {
    const body = await req.json();
    const { name, description, category, dailyRate, weeklyRate, quantity, imageUrl, image } = body;
    if (!name || !description || !category || dailyRate == null || weeklyRate == null) {
      return NextResponse.json(
        { error: "Missing required fields including description" },
        { status: 400 }
      );
    }
    const qty = Math.max(1, Number(quantity) || 1);
    const imgs = imagesJson(body);
    const data: Record<string, unknown> = {
      name: String(name),
      description: String(description),
      category: String(category),
      dailyRate: Number(dailyRate),
      weeklyRate: Number(weeklyRate),
      quantity: qty,
      available: qty,
      image: imageUrl || image || (imgs ? JSON.parse(imgs)[0] : null),
      images: imgs,
      active: body.active !== false,
    };
    if (body.hourlyRate != null) data.hourlyRate = Number(body.hourlyRate) || null;
    if (body.rateUnit) data.rateUnit = String(body.rateUnit);
    if (body.securityDeposit != null) data.securityDeposit = Number(body.securityDeposit) || 0;
    if (body.minHireDays != null) data.minHireDays = Number(body.minHireDays) || 1;
    if (body.maxHireDays != null) data.maxHireDays = Number(body.maxHireDays) || null;
    if (body.condition != null) data.condition = String(body.condition) || null;
    if (body.serialNumber != null) data.serialNumber = String(body.serialNumber) || null;

    try {
      const tool = await prisma.tool.create({ data: data as any });
      return NextResponse.json(tool, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/Unknown argument|Unknown field/i.test(msg)) {
        const tool = await prisma.tool.create({
          data: {
            name: String(name),
            description: String(description),
            category: String(category),
            dailyRate: Number(dailyRate),
            weeklyRate: Number(weeklyRate),
            quantity: qty,
            available: qty,
            image: (data.image as string) || null,
            active: body.active !== false,
          } as any,
        });
        return NextResponse.json(tool, { status: 201 });
      }
      throw e;
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to create tool", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  await healSchema().catch(() => null);
  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const existing = await prisma.tool.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.name != null) data.name = String(body.name);
    if (body.description != null) data.description = String(body.description);
    if (body.category != null) data.category = String(body.category);
    if (body.dailyRate != null) data.dailyRate = Number(body.dailyRate);
    if (body.weeklyRate != null) data.weeklyRate = Number(body.weeklyRate);
    if (body.hourlyRate != null) data.hourlyRate = Number(body.hourlyRate) || null;
    if (body.rateUnit != null) data.rateUnit = String(body.rateUnit);
    if (body.securityDeposit != null) data.securityDeposit = Number(body.securityDeposit) || 0;
    if (body.minHireDays != null) data.minHireDays = Number(body.minHireDays) || 1;
    if (body.maxHireDays != null) data.maxHireDays = Number(body.maxHireDays) || null;
    if (body.condition != null) data.condition = String(body.condition) || null;
    if (body.serialNumber != null) data.serialNumber = String(body.serialNumber) || null;
    if (body.active != null) data.active = Boolean(body.active);
    if (body.image != null || body.imageUrl != null) {
      data.image = body.imageUrl || body.image || null;
    }
    if (body.images != null) {
      data.images = imagesJson(body);
      if (!data.image && Array.isArray(body.images) && body.images[0]) {
        data.image = body.images[0];
      }
    }
    if (body.quantity != null) {
      const qty = Math.max(1, Number(body.quantity) || 1);
      data.quantity = qty;
      const prevQty = Number((existing as any).quantity || existing.available || 1);
      const delta = qty - prevQty;
      data.available = Math.max(0, existing.available + delta);
    }

    const tool = await prisma.tool.update({ where: { id }, data: data as any });
    return NextResponse.json(tool);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update tool", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    let id = new URL(req.url).searchParams.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id ? String(body.id) : null;
      } catch {
        id = null;
      }
    }
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const open = await prisma.toolRental.count({
      where: { toolId: id, status: { in: ["PENDING", "CONFIRMED", "ACTIVE", "OVERDUE"] } },
    });
    if (open > 0) {
      return NextResponse.json(
        { error: "Cannot delete tool with active or pending rentals. Cancel or complete them first." },
        { status: 400 }
      );
    }
    await prisma.payment.deleteMany({ where: { toolRental: { toolId: id } } }).catch(() => null);
    await prisma.toolRental.deleteMany({ where: { toolId: id } });
    await prisma.tool.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete tool" }, { status: 500 });
  }
}
