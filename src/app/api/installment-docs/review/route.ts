import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function clientHasSignature(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { signatureUrl: true } as any,
    });
    if ((user as any)?.signatureUrl) return true;
  } catch {
    /* */
  }
  try {
    const doc = await prisma.userDocument.findFirst({
      where: { userId, type: "SIGNATURE" },
    });
    return Boolean(doc?.fileUrl);
  } catch {
    return false;
  }
}

function isAgreementDoc(doc: { type?: string | null; label?: string | null }) {
  const s = `${doc.type || ""} ${doc.label || ""}`.toLowerCase();
  return /agreement|signed.?agreement|installment.?agreement/.test(s);
}

/** Admin approve / reject a single installment document */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await req.json();
    let { id, status, rejectReason } = body;
    if (!id || !["APPROVED", "REJECTED", "UNDER_REVIEW"].includes(status)) {
      return NextResponse.json({ error: "id and status required" }, { status: 400 });
    }

    const existing = await prisma.installmentDocument.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Agreement without client signature cannot be approved
    if (status === "APPROVED" && isAgreementDoc(existing)) {
      const hasSig = await clientHasSignature(existing.userId);
      if (!hasSig) {
        status = "REJECTED";
        rejectReason =
          rejectReason ||
          "Rejected: signed agreement requires the client's signature on file. Client must draw/upload signature and re-upload the stamped agreement.";
      }
    }

    const doc = await prisma.installmentDocument.update({
      where: { id },
      data: {
        status,
        rejectReason: status === "REJECTED" ? rejectReason || "Rejected by admin" : null,
      },
    });

    if (doc.reservationId) {
      const all = await prisma.installmentDocument.findMany({
        where: { reservationId: doc.reservationId },
      });
      const required = all.filter((d) => d.required !== false);
      let overall = "UNDER_REVIEW";
      if (required.some((d) => d.status === "REJECTED")) overall = "ACTION_NEEDED";
      else if (required.length && required.every((d) => d.status === "APPROVED"))
        overall = "APPROVED";

      try {
        await prisma.reservation.update({
          where: { id: doc.reservationId },
          data: { docsStatus: overall },
        });
      } catch {
        /* */
      }

      try {
        await prisma.notification.create({
          data: {
            userId: doc.userId,
            title:
              status === "APPROVED"
                ? "Document approved"
                : status === "REJECTED"
                  ? "Document rejected"
                  : "Document update",
            body:
              status === "APPROVED"
                ? `"${doc.label || doc.type}" was approved.`
                : status === "REJECTED"
                  ? `"${doc.label || doc.type}" was rejected: ${rejectReason || ""}. Please re-upload.`
                  : `Status updated for "${doc.label || doc.type}".`,
            type: "DOCUMENT",
          },
        });

        if (overall === "APPROVED") {
          await prisma.notification.create({
            data: {
              userId: doc.userId,
              title: "Installment documents approved",
              body: "All required documents are approved. You can pay the first deposit and start your plan.",
              type: "DOCUMENT",
            },
          });
        }
      } catch {
        /* */
      }
    }

    return NextResponse.json({
      ok: true,
      document: doc,
      autoRejectedForMissingSignature:
        status === "REJECTED" &&
        isAgreementDoc(doc) &&
        String(rejectReason || "").toLowerCase().includes("signature"),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Review failed" },
      { status: 500 }
    );
  }
}
