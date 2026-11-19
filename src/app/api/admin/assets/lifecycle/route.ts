import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { archiveSoldAsset, reopenAssetForSale } from "@/lib/asset-lifecycle";
import { assertSuperAdmin } from "@/lib/super-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function adminSession() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  if (!(session as any).email) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: session.id },
        select: { email: true, name: true },
      });
      return { ...session, email: u?.email, name: u?.name || session.name };
    } catch {
      /* */
    }
  }
  return session;
}

export async function POST(req: NextRequest) {
  const session = await adminSession();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const action = String(body.action || "").toUpperCase();
    const assetId = String(body.assetId || "");
    if (!assetId) {
      return NextResponse.json({ error: "assetId required" }, { status: 400 });
    }

    if (action === "ARCHIVE") {
      const result = await archiveSoldAsset({
        assetId,
        adminId: session.id,
        adminEmail: (session as any).email,
        adminName: (session as any).name,
        note: body.note ? String(body.note) : undefined,
      });
      return NextResponse.json(result);
    }

    if (action === "REOPEN") {
      const gate = await assertSuperAdmin(session as any);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error }, { status: 403 });
      }
      const result = await reopenAssetForSale({
        assetId,
        adminId: session.id,
        adminEmail: (session as any).email,
        adminName: (session as any).name,
        price: body.price != null ? Number(body.price) : undefined,
        description: body.description ? String(body.description) : undefined,
        title: body.title ? String(body.title) : undefined,
        note: body.note ? String(body.note) : undefined,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action. Use ARCHIVE or REOPEN." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}

export async function GET() {
  const session = await adminSession();
  if (!session) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const assets = await prisma.asset.findMany({
      where: { status: { in: ["SOLD", "ARCHIVED"] } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ assets });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
