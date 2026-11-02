import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/** Safe list — avoids Prisma selecting columns missing on older DBs */
async function listAssets(opts: { type?: string | null; status?: string | null; all?: boolean }) {
  try {
    return await prisma.$queryRawUnsafe<
      Record<string, unknown>[]
    >(
      `SELECT id, title, description, type, price, location, image, images,
              status, active, bedrooms, bathrooms, area, features,
              "createdAt", "updatedAt"
       FROM "Asset"
       WHERE ($1::text IS NULL OR type = $1)
         AND ($2::boolean OR status = COALESCE($3::text, 'AVAILABLE'))
       ORDER BY "createdAt" DESC`,
      opts.type || null,
      opts.all === true,
      opts.status || null
    );
  } catch {
    // Minimal columns fallback
    return prisma.$queryRaw<
      Record<string, unknown>[]
    >`SELECT id, title, description, type, price, location, status, "createdAt"
      FROM "Asset" ORDER BY "createdAt" DESC`;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const all = searchParams.get("all") === "1";
    const assets = await listAssets({ type, status, all });
    return NextResponse.json(assets);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch assets", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    if (!body.title || !body.description || !body.type || body.price == null) {
      return NextResponse.json(
        { error: "Missing required fields (title, description, type, price)" },
        { status: 400 }
      );
    }

    let images: string[] = [];
    if (Array.isArray(body.images)) images = body.images.filter(Boolean);
    else if (body.imageUrl) images = [body.imageUrl];
    else if (body.image) images = [body.image];

    const id =
      "c" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 10);
    const now = new Date();
    const title = String(body.title);
    const description = String(body.description);
    const type = String(body.type);
    const price = Number(body.price);
    const location = body.location ? String(body.location) : null;
    const image = images[0] || null;
    const imagesJson = images.length ? JSON.stringify(images) : null;
    const status = body.status || "AVAILABLE";
    const bedrooms = body.bedrooms != null ? Number(body.bedrooms) : null;
    const bathrooms = body.bathrooms != null ? Number(body.bathrooms) : null;
    const area =
      body.area != null
        ? Number(body.area)
        : body.size != null
          ? Number(body.size)
          : null;
    const features = body.features ? JSON.stringify(body.features) : null;

    await prisma.$executeRaw`
      INSERT INTO "Asset" (
        id, title, description, type, price, location, image, images,
        status, active, bedrooms, bathrooms, area, features,
        "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${title}, ${description}, ${type}, ${price}, ${location}, ${image}, ${imagesJson},
        ${status}, true, ${bedrooms}, ${bathrooms}, ${area}, ${features},
        ${now}, ${now}
      )
    `;

    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM "Asset" WHERE id = ${id} LIMIT 1
    `;
    return NextResponse.json(rows[0] || { id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create asset", detail: error instanceof Error ? error.message : "unknown" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await prisma.$executeRaw`DELETE FROM "Payment" WHERE "reservationId" IN (SELECT id FROM "Reservation" WHERE "assetId" = ${id})`;
    await prisma.$executeRaw`DELETE FROM "Reservation" WHERE "assetId" = ${id}`;
    await prisma.$executeRaw`DELETE FROM "Asset" WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
