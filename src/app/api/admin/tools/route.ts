import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const tools = await prisma.tool.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(tools);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const body = await req.json();
    const { name, description, category, dailyRate, weeklyRate, quantity, imageUrl, image } = body;
    if (!name || !description || !category || dailyRate == null || weeklyRate == null) {
      return NextResponse.json({ error: "Missing required fields including description" }, { status: 400 });
    }
    const qty = Number(quantity) || 1;
    const tool = await prisma.tool.create({
      data: {
        name,
        description,
        category,
        dailyRate: Number(dailyRate),
        weeklyRate: Number(weeklyRate),
        quantity: qty,
        available: qty,
        image: imageUrl || image || null,
      },
    });
    return NextResponse.json(tool, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create tool" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await prisma.payment.deleteMany({ where: { toolRental: { toolId: id } } });
    await prisma.toolRental.deleteMany({ where: { toolId: id } });
    await prisma.tool.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete tool" }, { status: 500 });
  }
}
