import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { filterDefaults, type ClientType } from "@/lib/installment-docs";

export const dynamic = "force-dynamic";

/** Mark installment doc package as submitted when all required items present */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { reservationId, category, clientType: ct } = await req.json();
    if (!reservationId) {
      return NextResponse.json({ error: "reservationId required" }, { status: 400 });
    }

    const reservation = await prisma.reservation.findFirst({
      where: { id: reservationId, userId: session.id },
      include: { asset: true },
    });
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    const clientType = (ct === "COMPANY" ? "COMPANY" : "INDIVIDUAL") as ClientType;
    const cat = (category || reservation.asset?.type || "HOUSE").toUpperCase();

    let requiredKeys: string[] = [];
    try {
      const db = await prisma.requiredDocumentType.findMany({
        where: { active: true, required: true },
      });
      requiredKeys = db
        .filter((r) => {
          const c = (r.category || "ALL").toUpperCase();
          const okCat = c === "ALL" || c === cat || !r.category;
          const t = (r.clientType || "BOTH").toUpperCase();
          const okCt = t === "BOTH" || t === clientType;
          return okCat && okCt;
        })
        .map((r) => r.key);
    } catch {
      requiredKeys = [];
    }
    if (!requiredKeys.length) {
      requiredKeys = filterDefaults(cat, clientType)
        .filter((d) => d.required)
        .map((d) => d.key);
    }

    const docs = await prisma.installmentDocument.findMany({
      where: { userId: session.id, reservationId },
    });

    const byType = new Map(docs.map((d) => [d.type, d]));
    const missing: string[] = [];
    for (const key of requiredKeys) {
      const d = byType.get(key);
      if (!d) {
        missing.push(key);
        continue;
      }
      if (d.status === "REJECTED") missing.push(key);
      // FILE needs fileUrl; TEXT needs textValue
      if ((d.inputType === "TEXT" || d.inputType === "FORM") && !d.textValue && !d.metaJson) {
        missing.push(key);
      }
      if ((!d.inputType || d.inputType === "FILE" || d.inputType === "GUARANTOR") && !d.fileUrl && !d.metaJson) {
        missing.push(key);
      }
    }

    if (missing.length) {
      return NextResponse.json(
        {
          error: "Upload all required documents before submitting",
          missing,
        },
        { status: 400 }
      );
    }

    // Mark pending docs under review
    await prisma.installmentDocument.updateMany({
      where: {
        userId: session.id,
        reservationId,
        status: { in: ["PENDING", "NOT_UPLOADED"] },
      },
      data: { status: "UNDER_REVIEW" },
    });

    try {
      await prisma.reservation.update({
        where: { id: reservationId },
        data: {
          docsStatus: "UNDER_REVIEW",
          paymentType: reservation.paymentType || "INSTALLMENT",
        },
      });
    } catch {
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { paymentType: reservation.paymentType || "INSTALLMENT" },
      });
    }

    try {
      await prisma.notification.create({
        data: {
          userId: session.id,
          title: "Documents submitted",
          body: "Your installment documents are under review. You can pay the first deposit after approval.",
          type: "DOCUMENT",
          link: "/dashboard",
        },
      });
    } catch {
      /* */
    }

    return NextResponse.json({
      ok: true,
      overall: "UNDER_REVIEW",
      message: "Documents submitted for review. You will be notified when approved.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Submit failed" }, { status: 500 });
  }
}
