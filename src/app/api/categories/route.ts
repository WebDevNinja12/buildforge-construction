import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureCategoryDefaults, getCategoryConfig } from "@/lib/maintenance";

export async function GET(req: NextRequest) {
  try {
    await ensureCategoryDefaults().catch(() => null);
    const category = new URL(req.url).searchParams.get("category");
    if (category) {
      const cfg = await getCategoryConfig(category);
      return NextResponse.json(cfg);
    }
    const all = await prisma.categoryDefault.findMany({
      include: { requiredDocs: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(all);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

/** Admin update category rules or required docs */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { category, ...fields } = body;
    if (!category) return NextResponse.json({ error: "category required" }, { status: 400 });

    if (body.action === "ADD_DOC") {
      const doc = await prisma.requiredDocumentType.create({
        data: {
          category,
          key: body.key || `doc_${Date.now()}`,
          label: body.label,
          description: body.description || null,
          required: body.required !== false,
          sortOrder: body.sortOrder || 0,
        },
      });
      return NextResponse.json(doc, { status: 201 });
    }
    if (body.action === "DELETE_DOC") {
      await prisma.requiredDocumentType.delete({ where: { id: body.docId } });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "UPDATE_DOC") {
      const doc = await prisma.requiredDocumentType.update({
        where: { id: body.docId },
        data: {
          label: body.label,
          description: body.description,
          required: body.required,
          active: body.active,
        },
      });
      return NextResponse.json(doc);
    }

    const updated = await prisma.categoryDefault.update({
      where: { category },
      data: {
        ...(fields.defaultExpiryHours != null ? { defaultExpiryHours: Number(fields.defaultExpiryHours) } : {}),
        ...(fields.installmentPlanMonths != null
          ? { installmentPlanMonths: Number(fields.installmentPlanMonths) }
          : {}),
        ...(fields.cancelDeductionPercent != null
          ? { cancelDeductionPercent: Number(fields.cancelDeductionPercent) }
          : {}),
        ...(fields.graceHours != null ? { graceHours: Number(fields.graceHours) } : {}),
        ...(fields.installmentRulesText != null ? { installmentRulesText: fields.installmentRulesText } : {}),
        ...(fields.continuesAfterHold != null ? { continuesAfterHold: !!fields.continuesAfterHold } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
