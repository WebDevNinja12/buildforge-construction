import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { healSchema } from "@/lib/schema-heal";

export const dynamic = "force-dynamic";

/**
 * Prisma client may only know legacy columns:
 * title, description, location, image, images, completedAt, published, createdAt, updatedAt
 * Extra fields (category, sortOrder, imageUrl) are stored in images as JSON meta.
 */
function parseMeta(images: string | null | undefined) {
  if (!images) return {} as Record<string, unknown>;
  try {
    const j = JSON.parse(images);
    if (j && typeof j === "object" && !Array.isArray(j)) return j as Record<string, unknown>;
  } catch {
    /* plain url string */
  }
  return {} as Record<string, unknown>;
}

function mapProject(p: any) {
  const meta = parseMeta(p.images);
  const imageUrl =
    (typeof meta.imageUrl === "string" && meta.imageUrl) ||
    p.imageUrl ||
    p.image ||
    (typeof p.images === "string" && p.images.startsWith("http") ? p.images : null) ||
    null;
  const category =
    (typeof meta.category === "string" && meta.category) || p.category || "RESIDENTIAL";
  const sortOrder =
    typeof meta.sortOrder === "number"
      ? meta.sortOrder
      : typeof p.sortOrder === "number"
        ? p.sortOrder
        : 0;
  const featured = p.featured !== false && p.published !== false && meta.featured !== false;

  return {
    id: p.id,
    title: p.title,
    description: p.description,
    location: p.location || "",
    category,
    completedAt: p.completedAt,
    imageUrl,
    image: p.image || imageUrl,
    featured,
    published: p.published !== false,
    sortOrder,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function buildImagesMeta(opts: {
  imageUrl?: string | null;
  category?: string;
  sortOrder?: number;
  featured?: boolean;
}) {
  return JSON.stringify({
    imageUrl: opts.imageUrl || null,
    category: opts.category || "RESIDENTIAL",
    sortOrder: Number(opts.sortOrder) || 0,
    featured: opts.featured !== false,
  });
}

export async function GET(req: NextRequest) {
  try {
    await healSchema().catch(() => null);
    const session = await getSession().catch(() => null);
    const adminAll = req.nextUrl.searchParams.get("all") === "1" && session?.role === "ADMIN";

    let projects: any[] = [];
    try {
      projects = await prisma.finishedProject.findMany({
        where: adminAll ? undefined : { published: true },
        orderBy: { createdAt: "desc" },
      });
    } catch (e) {
      console.error("finishedProject.findMany", e);
      return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
    }

    const mapped = (projects || []).map(mapProject);
    mapped.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return NextResponse.json(mapped);
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
    if (!img) {
      return NextResponse.json({ error: "Project image is required" }, { status: 400 });
    }

    // Only fields known to the deployed Prisma client
    const project = await prisma.finishedProject.create({
      data: {
        title: String(title).trim(),
        description: String(description).trim(),
        location: String(location).trim(),
        completedAt: new Date(completedAt),
        image: String(img),
        images: buildImagesMeta({
          imageUrl: img,
          category: category || "RESIDENTIAL",
          sortOrder: Number(sortOrder) || 0,
          featured: featured !== false,
        }),
        published: published !== false && featured !== false,
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
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const existing = await prisma.finishedProject.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const meta = parseMeta(existing.images);
    const img = body.imageUrl || body.image || existing.image || meta.imageUrl || null;
    const data: Record<string, unknown> = {};
    if (body.title != null) data.title = String(body.title).trim();
    if (body.description != null) data.description = String(body.description).trim();
    if (body.location != null) data.location = String(body.location).trim();
    if (body.completedAt) data.completedAt = new Date(body.completedAt);
    if (img) data.image = String(img);
    if (body.published != null) data.published = Boolean(body.published);
    if (body.featured != null) data.published = body.featured !== false;

    data.images = buildImagesMeta({
      imageUrl: img as string | null,
      category: body.category || meta.category || "RESIDENTIAL",
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : Number(meta.sortOrder) || 0,
      featured: body.featured !== false && meta.featured !== false,
    });

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
