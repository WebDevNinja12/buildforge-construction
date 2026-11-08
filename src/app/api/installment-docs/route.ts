import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function isNotExpired(expiresAt: Date | null | undefined) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

/** Latest approved doc of this type for the user (any prior plan) */
async function findReusableApproved(userId: string, type: string) {
  const rows = await prisma.installmentDocument.findMany({
    where: { userId, type, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  return rows.find((d) => isNotExpired(d.expiresAt)) || null;
}

/**
 * For a new installment reservation, attach previously approved docs
 * so the client does not re-upload unless they choose to update.
 */
async function autoAttachApprovedDocs(userId: string, reservationId: string) {
  const existing = await prisma.installmentDocument.findMany({
    where: { userId, reservationId },
  });
  const have = new Set(existing.map((d) => d.type));

  // All approved docs for this user (any reservation)
  const approved = await prisma.installmentDocument.findMany({
    where: { userId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const bestByType = new Map<string, (typeof approved)[0]>();
  for (const d of approved) {
    if (!isNotExpired(d.expiresAt)) continue;
    if (!bestByType.has(d.type)) bestByType.set(d.type, d);
  }

  const created: typeof existing = [];
  for (const [type, src] of bestByType) {
    if (have.has(type)) continue;
    // Skip empty shells
    if (!src.fileUrl && !src.textValue && !src.metaJson) continue;
    try {
      const row = await prisma.installmentDocument.create({
        data: {
          userId,
          reservationId,
          type: src.type,
          label: src.label,
          fileUrl: src.fileUrl || "",
          fileName: src.fileName,
          textValue: src.textValue,
          metaJson: src.metaJson,
          inputType: src.inputType || "FILE",
          required: src.required !== false,
          status: "APPROVED",
          expiresAt: src.expiresAt,
          previousFileUrl: src.id, // track source id for audit
        },
      });
      created.push(row);
      have.add(type);
    } catch (e) {
      console.warn("autoAttach failed", type, e);
    }
  }
  return created;
}

function computeOverall(docs: { required?: boolean | null; status: string }[]) {
  if (!docs.length) return "INCOMPLETE";
  const required = docs.filter((d) => d.required !== false);
  const pool = required.length ? required : docs;
  if (pool.some((d) => d.status === "REJECTED")) return "ACTION_NEEDED";
  if (pool.every((d) => d.status === "APPROVED")) return "APPROVED";
  if (pool.some((d) => d.status === "PENDING" || d.status === "UNDER_REVIEW"))
    return "UNDER_REVIEW";
  return "INCOMPLETE";
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const reservationId = req.nextUrl.searchParams.get("reservationId");

    // Auto-reuse approved docs onto this reservation for clients
    if (reservationId && session.role !== "ADMIN") {
      const owns = await prisma.reservation.findFirst({
        where: { id: reservationId, userId: session.id },
        select: { id: true },
      });
      if (owns) {
        await autoAttachApprovedDocs(session.id, reservationId).catch((e) =>
          console.warn("autoAttach", e)
        );
      }
    }

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

    // Deduplicate by type (keep newest)
    const byType = new Map<string, (typeof docs)[0]>();
    for (const d of docs) {
      if (!byType.has(d.type)) byType.set(d.type, d);
    }
    const unique = Array.from(byType.values());

    const overall = reservationId ? computeOverall(unique) : "INCOMPLETE";

    // Sync reservation docsStatus when everything is already approved via reuse
    if (reservationId && overall === "APPROVED" && session.role !== "ADMIN") {
      try {
        await prisma.reservation.update({
          where: { id: reservationId },
          data: { docsStatus: "APPROVED" },
        });
      } catch {
        /* */
      }
    }

    return NextResponse.json({
      documents: unique.map((d) => ({
        ...d,
        reused: Boolean(d.previousFileUrl && d.status === "APPROVED"),
        canUpdate: true,
      })),
      overall,
      message:
        overall === "APPROVED"
          ? "Previously approved documents were applied. You only need to upload if you want to update a document."
          : undefined,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load documents" }, { status: 500 });
  }
}

/** Upsert one document (file or text/guarantor meta) — replace/update only when client uploads new data */
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
      reuse = false,
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

    const userId = session.role === "ADMIN" ? reservation.userId : session.id;

    // Explicit reuse of an already-approved document of this type
    if (reuse || (!fileUrl && !textValue && !meta)) {
      const existingApproved = await findReusableApproved(userId, key);
      if (existingApproved) {
        const existingOnPlan = await prisma.installmentDocument.findFirst({
          where: { userId, reservationId, type: key },
        });
        if (existingOnPlan?.status === "APPROVED") {
          return NextResponse.json({ ...existingOnPlan, reused: true });
        }
        if (existingOnPlan) {
          const updated = await prisma.installmentDocument.update({
            where: { id: existingOnPlan.id },
            data: {
              fileUrl: existingApproved.fileUrl || "",
              fileName: existingApproved.fileName,
              textValue: existingApproved.textValue,
              metaJson: existingApproved.metaJson,
              status: "APPROVED",
              rejectReason: null,
              previousFileUrl: existingApproved.id,
              label: label || existingApproved.label,
            },
          });
          return NextResponse.json({ ...updated, reused: true });
        }
        const cloned = await prisma.installmentDocument.create({
          data: {
            userId,
            reservationId,
            type: key,
            label: label || existingApproved.label,
            fileUrl: existingApproved.fileUrl || "",
            fileName: existingApproved.fileName,
            textValue: existingApproved.textValue,
            metaJson: existingApproved.metaJson,
            status: "APPROVED",
            required: required !== false,
            inputType: existingApproved.inputType || inputType,
            previousFileUrl: existingApproved.id,
          },
        });
        return NextResponse.json({ ...cloned, reused: true }, { status: 201 });
      }
      if (reuse) {
        return NextResponse.json(
          { error: "No approved document of this type to reuse" },
          { status: 404 }
        );
      }
    }

    if (inputType === "FILE" && !fileUrl) {
      return NextResponse.json({ error: "Upload a file first" }, { status: 400 });
    }
    if (inputType === "TEXT" && !textValue) {
      return NextResponse.json({ error: "Value required" }, { status: 400 });
    }

    const existing = await prisma.installmentDocument.findFirst({
      where: { userId, reservationId, type: key },
    });

    const metaJson = meta ? JSON.stringify(meta) : undefined;

    // Updating a document → goes back under review
    const nextStatus = "UNDER_REVIEW";

    if (existing) {
      const updated = await prisma.installmentDocument.update({
        where: { id: existing.id },
        data: {
          label: label || existing.label,
          fileUrl: fileUrl != null ? fileUrl : existing.fileUrl,
          fileName: fileName != null ? fileName : existing.fileName,
          textValue: textValue != null ? textValue : existing.textValue,
          metaJson: metaJson != null ? metaJson : existing.metaJson,
          inputType,
          required: required !== false,
          status: nextStatus,
          rejectReason: null,
          previousFileUrl: existing.fileUrl || existing.previousFileUrl,
        },
      });
      try {
        await prisma.reservation.update({
          where: { id: reservationId },
          data: { docsStatus: "UNDER_REVIEW" },
        });
      } catch {
        /* */
      }
      return NextResponse.json({
        ...updated,
        reused: false,
        message: "Document updated — sent for admin review",
      });
    }

    const created = await prisma.installmentDocument.create({
      data: {
        userId,
        reservationId,
        type: key,
        label: label || key,
        fileUrl: fileUrl || "",
        fileName: fileName || null,
        textValue: textValue || null,
        metaJson: metaJson || null,
        inputType,
        required: required !== false,
        status: nextStatus,
      },
    });

    try {
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { docsStatus: "UNDER_REVIEW" },
      });
    } catch {
      /* */
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Save failed" },
      { status: 500 }
    );
  }
}
