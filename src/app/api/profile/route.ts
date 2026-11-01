import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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
      avatarUrl: true,
      signatureUrl: true,
      clientType: true,
      status: true,
      verificationStatus: true,
      verificationNote: true,
    },
  });

  const documents = await prisma.userDocument.findMany({
    where: { userId: session.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ ...user, documents });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.phone === "string") data.phone = body.phone.trim();
  if (typeof body.avatarUrl === "string") data.avatarUrl = body.avatarUrl;
  if (typeof body.signatureUrl === "string") data.signatureUrl = body.signatureUrl;

  await prisma.user.update({ where: { id: session.id }, data });

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  });

  return NextResponse.json({ message: "Profile updated", ...user });
}
