import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const list = await prisma.testimonial.findMany({
      where: { active: true, featured: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      take: 12,
    });
    return NextResponse.json(list);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { clientName, role, project, quote, rating, featured } = body;
    if (!clientName || !quote) {
      return NextResponse.json({ error: "clientName and quote required" }, { status: 400 });
    }
    const t = await prisma.testimonial.create({
      data: {
        clientName,
        role: role || null,
        project: project || null,
        quote,
        rating: Number(rating) || 5,
        featured: featured !== false,
        active: true,
      },
    });
    return NextResponse.json(t, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.testimonial.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
