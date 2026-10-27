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
  const workers = await prisma.worker.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(workers);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const body = await req.json();
    const { name, specialty, experience, dailyRate, rating, bio, imageUrl, image } = body;
    if (!name || !specialty || experience == null || dailyRate == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const worker = await prisma.worker.create({
      data: {
        name,
        specialty,
        experience: Number(experience),
        dailyRate: Number(dailyRate),
        rating: rating != null ? Number(rating) : 4.5,
        bio: bio || null,
        image: imageUrl || image || null,
        available: true,
      },
    });
    return NextResponse.json(worker, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create worker" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await prisma.hireRequest.updateMany({ where: { workerId: id }, data: { workerId: null } });
    await prisma.worker.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete worker" }, { status: 500 });
  }
}
