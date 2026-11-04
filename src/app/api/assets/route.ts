import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { recordAdminActivity } from "@/lib/admin-activity";

async function listAssets(opts: { type?: string | null; status?: string | null; all?: boolean }) {
  try {
    return await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
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
    return prisma.$queryRaw<
      Record<string, unknown>[]
    >`SELECT id, title, description, type, price, location, status, "createdAt"
      FROM "Asset" ORDER BY "createdAt" DESC`;
  }
}

async function deleteAssetById(id: string) {
  await prisma.$executeRaw`DELETE FROM "Payment" WHERE "reservationId" IN (SELECT id FROM "Reservation" WHERE "assetId" = ${id})`;
  await prisma.$executeRaw`DELETE FROM "Reservation" WHERE "assetId" = ${id}`;
  await prisma.$executeRaw`DELETE FROM "Asset" WHERE id = ${id}`;
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
      {
        error: "Failed to fetch assets",
        detail: error instanceof Error ? error.message : "unknown",
      },
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

    const id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
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
      body.area != null ? Number(body.area) : body.size != null ? Number(body.size) : null;
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

    const rows = await prisma.$queryRaw<
      Record<string, unknown>[]
    >`SELECT * FROM "Asset" WHERE id = ${id} LIMIT 1`;

    await recordAdminActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      action: "SERVICE_CREATE",
      entity: "Asset",
      entityId: id,
      details: { title, type, price },
    });

    return NextResponse.json(rows[0] || { id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: "Failed to create asset",
        detail: error instanceof Error ? error.message : "unknown",
      },
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
    const url = new URL(req.url);
    const singleId = url.searchParams.get("id");
    const clearAll = url.searchParams.get("all") === "1";

    let ids: string[] = [];

    if (clearAll) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Asset"`;
      ids = rows.map((r) => r.id);
    } else if (singleId) {
      ids = [singleId];
    } else {
      try {
        const body = await req.json();
        if (Array.isArray(body?.ids)) {
          ids = body.ids.map((x: unknown) => String(x)).filter(Boolean);
        }
      } catch {
        /* no body */
      }
    }

    if (!ids.length) {
      return NextResponse.json({ error: "Provide id, ids[], or all=1" }, { status: 400 });
    }

    let deleted = 0;
    const errors: string[] = [];
    for (const id of ids) {
      try {
        await deleteAssetById(id);
        deleted++;
      } catch (e) {
        errors.push(`${id}: ${e instanceof Error ? e.message : "fail"}`);
      }
    }

    await recordAdminActivity({
      adminId: session.id,
      adminEmail: session.email,
      adminName: session.name,
      action: clearAll ? "SERVICES_CLEAR_ALL" : "SERVICES_DELETE",
      entity: "Asset",
      entityId: ids[0] || null,
      details: { count: deleted, requested: ids.length, clearAll },
    });

    return NextResponse.json({
      ok: true,
      deleted,
      requested: ids.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to delete", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
