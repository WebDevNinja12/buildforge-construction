import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const reservationId = req.nextUrl.searchParams.get("reservationId");
    const where: any =
      session.role === "ADMIN"
        ? reservationId
          ? { reservationId }
          : {}
        : reservationId
          ? { userId: session.id, reservationId }
          : { userId: session.id };

    const docs = await prisma.installmentDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Overall status for a reservation
    let overall = "INCOMPLETE";
    if (reservationId) {
      const requiredPending = docs.filter(
        (d) => d.required !== false && !["APPROVED"].includes(d.status)
      );
      const anyRejected = docs.some((d) => d.status === "REJECTED");
      const anyReview = docs.some((d) => d.status === "PENDING" || d.status === "UNDER_REVIEW");
      if (anyRejected) overall = "ACTION_NEEDED";
      else if (requiredPending.length === 0 && docs.length > 0) overall = "APPROVED";
      else if (anyReview) overall = "UNDER_REVIEW";
      else overall = "INCOMPLETE";
    }

    return NextResponse.json({ documents: docs, overall });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load documents" }, { status: 500 });
  }
}

/** Upsert one document (file or text/guarantor meta) */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      reservationId,
      key,
      label,
      fileUrl,
      fileName,
      textValue,
      meta,
      required = true,
      inputType = "FILE",
    } = body;

    if (!reservationId || !key) {
      return NextResponse.json({ error: "reservationId and key required" }, { status: 400 });
    }

    const reservation = await prisma.reservation.findFirst({
      where:
        session.role === "ADMIN"
          ? { id: reservationId }
          : { id: reservationId, userId: session.id },
    });
    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (inputType === "FILE" && !fileUrl) {
      return NextResponse.json({ error: "Upload a file first" }, { status: 400 });
    }
    if (inputType === "TEXT" && !textValue) {
      return NextResponse.json({ error: "Value required" }, { status: 400 });
    }

    // Reuse approved docs of same type for this user (unless expired)
    const existingApproved = await prisma.installmentDocument.findFirst({
      where: {
        userId: session.id,
        type: key,
        status: "APPROVED",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingApproved && !fileUrl && !textValue && body.reuse) {
      const cloned = await prisma.installmentDocument.create({
        data: {
          userId: session.id,
          reservationId,
          type: key,
          label: label || existingApproved.label,
          fileUrl: existingApproved.fileUrl,
          fileName: existingApproved.fileName,
          textValue: existingApproved.textValue,
          metaJson: existingApproved.metaJson,
          status: "APPROVED",
          required: required !== false,
          inputType: existingApproved.inputType || inputType,
        },
      });
      return NextResponse.json(cloned, { status: 201 });
    }

    const existing = await prisma.installmentDocument.findFirst({
      where: { userId: session.id, reservationId, type: key },
    });

    const data = {
      label: label || key,
      fileUrl: fileUrl || existing?.fileUrl || "",
      fileName: fileName || null,
      textValue: textValue || null,
      metaJson: meta ? JSON.stringify(meta) : null,
      status: "UNDER_REVIEW",
      rejectReason: null,
      required: required !== false,
      inputType,
      updatedAt: new Date(),
    };

    let row;
    if (existing) {
      row = await prisma.installmentDocument.update({
        where: { id: existing.id },
        data,
      });
    } else {
      row = await prisma.installmentDocument.create({
        data: {
          userId: session.id,
          reservationId,
          type: key,
          ...data,
        },
      });
    }

    // Update reservation docsStatus
    try {
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { docsStatus: "UNDER_REVIEW" },
      });
    } catch {
      /* column may not exist yet */
    }

    try {
      await prisma.notification.create({
        data: {
          userId: session.id,
          title: "Document received",
          body: `We received "${label || key}" for review.`,
          type: "DOCUMENT",
          link: "/dashboard",
        },
      });
    } catch {
      /* */
    }

    return NextResponse.json(row, { status: existing ? 200 : 201 });
  } catch (e) {
    console.error("installment-docs POST", e);
    return NextResponse.json(
      { error: "Save failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
