import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      status: true,
      verificationStatus: true,
      verificationNote: true,
      approvedAt: true,
      verifiedAt: true,
      archivedAt: true,
      archiveReason: true,
      createdAt: true,
      documents: true,
      reservations: {
        include: {
          asset: true,
          installments: { orderBy: { sequence: "asc" } },
          payments: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      payments: { orderBy: { createdAt: "desc" }, take: 50 },
      notifications: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

/** Replace/add client document */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();

  if (body.action === "UPSERT_DOCUMENT") {
    if (body.documentId) {
      const doc = await prisma.userDocument.update({
        where: { id: body.documentId },
        data: {
          fileUrl: body.fileUrl ?? undefined,
          fileName: body.fileName ?? undefined,
          label: body.label ?? undefined,
          type: body.type ?? undefined,
          status: body.status ?? undefined,
          rejectReason: body.rejectReason ?? undefined,
        },
      });
      await prisma.adminActivityLog.create({
        data: {
          adminId: admin.id,
          action: "UPDATE_DOCUMENT",
          entity: "UserDocument",
          entityId: doc.id,
          details: JSON.stringify({ userId: id }),
        },
      });
      return NextResponse.json(doc);
    }
    const doc = await prisma.userDocument.create({
      data: {
        userId: id,
        type: body.type || "OTHER",
        label: body.label || null,
        fileUrl: body.fileUrl,
        fileName: body.fileName || null,
        status: body.status || "APPROVED",
      },
    });
    return NextResponse.json(doc, { status: 201 });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
