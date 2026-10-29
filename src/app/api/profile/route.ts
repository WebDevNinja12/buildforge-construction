import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      verificationStatus: true,
      createdAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const avatar = await prisma.userDocument.findFirst({
    where: { userId: session.id, type: "AVATAR" },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    ...user,
    avatarUrl: avatar?.fileUrl || null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.phone === "string") data.phone = body.phone.trim() || null;

  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: session.id }, data });
  }

  if (typeof body.avatarUrl === "string") {
    const url = body.avatarUrl.trim();
    if (url) {
      const existing = await prisma.userDocument.findFirst({
        where: { userId: session.id, type: "AVATAR" },
      });
      if (existing) {
        await prisma.userDocument.update({
          where: { id: existing.id },
          data: { fileUrl: url, fileName: "avatar", status: "APPROVED", label: "Profile photo" },
        });
      } else {
        await prisma.userDocument.create({
          data: {
            userId: session.id,
            type: "AVATAR",
            label: "Profile photo",
            fileUrl: url,
            fileName: "avatar",
            status: "APPROVED",
          },
        });
      }
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, phone: true },
  });
  const avatar = await prisma.userDocument.findFirst({
    where: { userId: session.id, type: "AVATAR" },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    ...user,
    avatarUrl: avatar?.fileUrl || null,
    message: "Profile updated",
  });
}
