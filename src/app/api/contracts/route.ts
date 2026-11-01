import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where =
    session.role === "ADMIN"
      ? {}
      : { userId: session.id };

  const contracts = await prisma.contract.findMany({
    where,
    orderBy: { issuedAt: "desc" },
  });
  return NextResponse.json({ contracts });
}
