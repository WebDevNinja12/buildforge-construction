import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const projects = await prisma.finishedProject.findMany({
      where: { featured: true },
      orderBy: [{ sortOrder: "asc" }, { completedAt: "desc" }],
    });
    return NextResponse.json(projects);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { title, description, location, category, completedAt, imageUrl, featured, sortOrder } = body;
    if (!title || !description || !location || !completedAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const project = await prisma.finishedProject.create({
      data: {
        title,
        description,
        location,
        category: category || "RESIDENTIAL",
        completedAt: new Date(completedAt),
        imageUrl: imageUrl || null,
        featured: featured !== false,
        sortOrder: sortOrder ?? 0,
      },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    if (data.completedAt) data.completedAt = new Date(data.completedAt);
    const project = await prisma.finishedProject.update({
      where: { id },
      data,
    });
    return NextResponse.json(project);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await prisma.finishedProject.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
