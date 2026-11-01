import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Admin approve / reject a single installment document */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { id, status, rejectReason } = await req.json();
    if (!id || !["APPROVED", "REJECTED", "UNDER_REVIEW"].includes(status)) {
      return NextResponse.json({ error: "id and status required" }, { status: 400 });
    }

    const doc = await prisma.installmentDocument.update({
      where: { id },
      data: {
        status,
        rejectReason: status === "REJECTED" ? rejectReason || "Rejected by admin" : null,
      },
    });

    // Recompute overall for reservation
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
            link: "/dashboard",
          },
        });

        if (overall === "APPROVED") {
          await prisma.notification.create({
            data: {
              userId: doc.userId,
              title: "Installment documents approved",
              body: "All required documents are approved. You can pay the first deposit and start your plan.",
              type: "DOCUMENT",
              link: "/dashboard",
            },
          });
        }
      } catch {
        /* */
      }
    }

    return NextResponse.json(doc);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Review failed" }, { status: 500 });
  }
}
