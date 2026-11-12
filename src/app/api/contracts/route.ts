import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { healSchema } from "@/lib/schema-heal";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await healSchema().catch(() => null);
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const where = session.role === "ADMIN" ? {} : { userId: session.id };

    let contracts: any[] = [];
    try {
      contracts = await prisma.contract.findMany({
        where,
        orderBy: { issuedAt: "desc" },
      });
    } catch {
      contracts = await prisma.contract.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({ contracts });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load contracts" }, { status: 500 });
  }
}
