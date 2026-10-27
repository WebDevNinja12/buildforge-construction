import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const worker = await prisma.worker.findUnique({
      where: { id },
      include: {
        reviews: {
          where: { visible: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!worker || !worker.active) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 });
    }
    return NextResponse.json(worker);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const worker = await prisma.worker.update({
      where: { id },
      data: {
        ...(body.name != null ? { name: body.name } : {}),
        ...(body.specialty != null ? { specialty: body.specialty } : {}),
        ...(body.experience != null ? { experience: Number(body.experience) } : {}),
        ...(body.dailyRate != null ? { dailyRate: Number(body.dailyRate) } : {}),
        ...(body.bio != null ? { bio: body.bio } : {}),
        ...(body.image != null ? { image: body.image } : {}),
        ...(body.location != null ? { location: body.location } : {}),
        ...(body.skills != null
          ? { skills: typeof body.skills === "string" ? body.skills : JSON.stringify(body.skills) }
          : {}),
        ...(body.gallery != null
          ? { gallery: typeof body.gallery === "string" ? body.gallery : JSON.stringify(body.gallery) }
          : {}),
        ...(body.pastWork != null
          ? { pastWork: typeof body.pastWork === "string" ? body.pastWork : JSON.stringify(body.pastWork) }
          : {}),
        ...(body.available != null ? { available: !!body.available } : {}),
        ...(body.active != null ? { active: !!body.active } : {}),
        ...(body.rating != null ? { rating: Number(body.rating) } : {}),
      },
    });
    return NextResponse.json(worker);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
