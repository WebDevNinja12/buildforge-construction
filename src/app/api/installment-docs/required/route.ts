import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  filterDefaults,
  type ClientType,
} from "@/lib/installment-docs";

export const dynamic = "force-dynamic";

/** List required docs for category + client type (DB overrides defaults) */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const category = (sp.get("category") || "HOUSE").toUpperCase();
    let clientType = (sp.get("clientType") || "INDIVIDUAL").toUpperCase() as ClientType;
    if (clientType !== "COMPANY") clientType = "INDIVIDUAL";

    const session = await getSession();
    if (session) {
      try {
        const u = await prisma.user.findUnique({
          where: { id: session.id },
          select: { clientType: true },
        });
        if (u?.clientType === "COMPANY" || u?.clientType === "INDIVIDUAL") {
          clientType = u.clientType as ClientType;
        }
      } catch {
        /* clientType column may not exist yet */
      }
    }

    let fromDb: any[] = [];
    try {
      fromDb = await prisma.requiredDocumentType.findMany({
        where: {
          active: true,
          OR: [
            { category: category },
            { category: "ALL" },
            { category: "" },
          ],
        },
        orderBy: { sortOrder: "asc" },
      });
    } catch {
      fromDb = [];
    }

    const filteredDb = fromDb.filter((row) => {
      const ct = (row.clientType || "BOTH").toUpperCase();
      return ct === "BOTH" || ct === clientType;
    });

    if (filteredDb.length) {
      return NextResponse.json({
        category,
        clientType,
        source: "database",
        documents: filteredDb.map((r) => ({
          id: r.id,
          key: r.key,
          label: r.label,
          instruction: r.instruction || "",
          required: r.required !== false,
          inputType: r.inputType || "FILE",
          sortOrder: r.sortOrder ?? 0,
        })),
      });
    }

    const defaults = filterDefaults(category, clientType);
    return NextResponse.json({
      category,
      clientType,
      source: "defaults",
      documents: defaults.map((d) => ({
        id: d.key,
        key: d.key,
        label: d.label,
        instruction: d.instruction,
        required: d.required,
        inputType: d.inputType,
        sortOrder: d.sortOrder,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load required documents" }, { status: 500 });
  }
}
