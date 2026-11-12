import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { healSchema } from "@/lib/schema-heal";

export const dynamic = "force-dynamic";

function mapProject(p: any) {
  const imageUrl = p.imageUrl || p.image || null;
  return {
    ...p,
    imageUrl,
    category: p.category || "RESIDENTIAL",
    featured: p.featured !== false && p.published !== false,
  };
}

export async function GET(req: NextRequest) {
  try {
    await healSchema().catch(() => null);
    const session = await getSession().catch(() => null);
    const adminAll = req.nextUrl.searchParams.get("all") === "1" && session?.role === "ADMIN";

    let projects: any[] = [];
    try {
      projects = await prisma.finishedProject.findMany({
        where: adminAll ? undefined : { OR: [{ featured: true }, { published: true }] },
        orderBy: [{ sortOrder: "asc" }, { completedAt: "desc" }],
      });
    } catch {
      projects = await prisma.finishedProject.findMany({
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json((projects || []).map(mapProject));
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
    await healSchema().catch(() => null);
    const body = await req.json();
    const {
      title,
      description,
      location,
      category,
      completedAt,
      imageUrl,
      featured,
      published,
      sortOrder,
    } = body;
    if (!title || !description || !location || !completedAt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const img = imageUrl || body.image || null;
    const project = await prisma.finishedProject.create({
      data: {
        title,
        description,
        location,
        category: category || "RESIDENTIAL",
        completedAt: new Date(completedAt),
        imageUrl: img,
        image: img,
        featured: featured !== false,
        published: published !== false,
        sortOrder: Number(sortOrder) || 0,
      },
    });
    return NextResponse.json(mapProject(project), { status: 201 });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Failed to create project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    await healSchema().catch(() => null);
    const body = await req.json();
    const { id, ...raw } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const data: any = { ...raw };
    if (data.completedAt) data.completedAt = new Date(data.completedAt);
    if (data.imageUrl) data.image = data.imageUrl;
    if (data.image && !data.imageUrl) data.imageUrl = data.image;
    delete data.id;
    const project = await prisma.finishedProject.update({ where: { id }, data });
    return NextResponse.json(mapProject(project));
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
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await prisma.finishedProject.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
