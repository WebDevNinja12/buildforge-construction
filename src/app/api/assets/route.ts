import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status") || "AVAILABLE";

    const assets = await prisma.asset.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const asset = await prisma.asset.create({
      data: {
        title: body.title,
        description: body.description,
        type: body.type,
        price: body.price,
        location: body.location,
        size: body.size,
        bedrooms: body.bedrooms,
        bathrooms: body.bathrooms,
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
