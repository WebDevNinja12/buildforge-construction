import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const all = searchParams.get("all") === "1";

    const assets = await prisma.asset.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(status ? { status } : all ? {} : { status: "AVAILABLE" }),
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(assets);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    if (!body.title || !body.description || !body.type || body.price == null || !body.location) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const asset = await prisma.asset.create({
      data: {
        title: body.title,
        description: body.description,
        type: body.type,
        price: Number(body.price),
        location: body.location,
        size: body.size || null,
        bedrooms: body.bedrooms != null ? Number(body.bedrooms) : null,
        bathrooms: body.bathrooms != null ? Number(body.bathrooms) : null,
        images: JSON.stringify(body.images || []),
        features: JSON.stringify(body.features || []),
        status: body.status || "AVAILABLE",
      },
    });
    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
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
    await prisma.payment.deleteMany({ where: { reservation: { assetId: id } } });
    await prisma.reservation.deleteMany({ where: { assetId: id } });
    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
  }
}
