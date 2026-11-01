import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { buildAgreementPdf, nextContractNumber, randomVerifyToken } from "@/lib/contracts";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        clientType: true,
        role: true,
        status: true,
        verificationStatus: true,
        verificationNote: true,
        avatarUrl: true,
        signatureUrl: true,
        nin: true,
        bvn: true,
        nextOfKinJson: true,
        approvedAt: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user || user.role === "ADMIN") {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const [regDocs, instDocs, reservations, payments, contracts, logs, toolRentals, hires] =
      await Promise.all([
        prisma.userDocument.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } }),
        prisma.installmentDocument.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } }),
        prisma.reservation.findMany({
          where: { userId: id },
          include: { asset: true, payments: { orderBy: { createdAt: "desc" } } },
          orderBy: { createdAt: "desc" },
        }),
        prisma.payment.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
        prisma.contract.findMany({ where: { userId: id }, orderBy: { issuedAt: "desc" } }),
        prisma.adminActivityLog.findMany({
          where: { entityId: id },
          orderBy: { createdAt: "desc" },
          take: 40,
        }),
        prisma.toolRental.findMany({
          where: { userId: id },
          include: { tool: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.hireRequest.findMany({
          where: { userId: id },
          include: { worker: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    return NextResponse.json({
      user,
      registrationDocuments: regDocs,
      installmentDocuments: instDocs,
      reservations,
      payments,
      contracts,
      activity: logs,
      toolRentals,
      hireRequests: hires,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const action = body.action as string;

  try {
    if (action === "UPDATE_CLIENT") {
      const data: Record<string, unknown> = {};
      for (const k of [
        "name",
        "phone",
        "clientType",
        "status",
        "verificationStatus",
        "verificationNote",
        "nin",
        "bvn",
        "nextOfKinJson",
      ]) {
        if (body[k] !== undefined) data[k] = body[k];
      }
      if (body.verificationStatus === "VERIFIED") data.verifiedAt = new Date();
      if (body.status === "APPROVED") data.approvedAt = new Date();
      const user = await prisma.user.update({ where: { id }, data });
      await prisma.adminActivityLog.create({
        data: {
          adminId: admin.id,
          action: "UPDATE_CLIENT",
          entity: "User",
          entityId: id,
          details: JSON.stringify(data),
        },
      });
      return NextResponse.json({ user });
    }

    if (action === "BATCH_REVIEW_DOCS") {
      const reviews = Array.isArray(body.reviews) ? body.reviews : [];
      const results = [];
      for (const r of reviews) {
        if (!r.id || !r.status) continue;
        if (r.status === "REJECTED" && !r.rejectReason) {
          return NextResponse.json(
            { error: "Remark required when rejecting a document" },
            { status: 400 }
          );
        }
        const source = r.source === "REGISTRATION" ? "registration" : "installment";
        if (source === "registration") {
          const doc = await prisma.userDocument.update({
            where: { id: r.id },
            data: {
              status: r.status,
              rejectReason: r.status === "REJECTED" ? r.rejectReason : null,
            },
          });
          results.push(doc);
        } else {
          const existing = await prisma.installmentDocument.findUnique({ where: { id: r.id } });
          const doc = await prisma.installmentDocument.update({
            where: { id: r.id },
            data: {
              status: r.status,
              rejectReason: r.status === "REJECTED" ? r.rejectReason : null,
              previousRejectReason:
                r.status === "REJECTED"
                  ? r.rejectReason
                  : existing?.previousRejectReason || null,
            },
          });
          results.push(doc);
          if (r.status === "REJECTED") {
            await prisma.notification.create({
              data: {
                userId: id,
                title: "Document rejected",
                body: `Document rejected: ${r.rejectReason}. Please re-upload.`,
                type: "DOC_REJECTED",
              },
            });
          }
        }
        await prisma.adminActivityLog.create({
          data: {
            adminId: admin.id,
            action: r.status === "APPROVED" ? "APPROVE_DOCUMENT" : "REJECT_DOCUMENT",
            entity: source === "registration" ? "UserDocument" : "InstallmentDocument",
            entityId: r.id,
            details: JSON.stringify({ remark: r.rejectReason || null, userId: id }),
          },
        });
      }

      // refresh reservation docsStatus
      const pendingRes = await prisma.reservation.findMany({
        where: { userId: id, paymentType: "INSTALLMENT" },
      });
      for (const res of pendingRes) {
        const docs = await prisma.installmentDocument.findMany({
          where: { reservationId: res.id, required: true },
        });
        if (!docs.length) continue;
        const allApproved = docs.every((d) => d.status === "APPROVED");
        const anyRejected = docs.some((d) => d.status === "REJECTED");
        const anyPending = docs.some((d) =>
          ["PENDING", "UNDER_REVIEW", "NOT_UPLOADED"].includes(d.status)
        );
        const docsStatus = allApproved
          ? "APPROVED"
          : anyRejected
            ? "ACTION_NEEDED"
            : anyPending
              ? "UNDER_REVIEW"
              : "INCOMPLETE";
        await prisma.reservation.update({
          where: { id: res.id },
          data: { docsStatus },
        });
      }

      return NextResponse.json({ ok: true, results });
    }

    if (action === "FINAL_APPROVE") {
      const requiredInst = await prisma.installmentDocument.findMany({
        where: { userId: id, required: true },
      });
      const requiredReg = await prisma.userDocument.findMany({ where: { userId: id } });
      const blockers = [
        ...requiredInst.filter((d) => d.status !== "APPROVED"),
        ...requiredReg.filter((d) => d.status !== "APPROVED" && d.status !== "PENDING" ? d.status !== "APPROVED" : false),
      ];
      // Only block if there are required installment docs not approved
      const instBlock = requiredInst.filter((d) => d.status !== "APPROVED");
      if (instBlock.length) {
        return NextResponse.json(
          {
            error: "Cannot approve: some required documents are still pending or rejected",
            pending: instBlock.map((d) => ({ id: d.id, label: d.label, status: d.status })),
          },
          { status: 400 }
        );
      }

      const user = await prisma.user.update({
        where: { id },
        data: {
          status: "APPROVED",
          verificationStatus: "VERIFIED",
          verifiedAt: new Date(),
          approvedAt: new Date(),
        },
      });

      await prisma.notification.create({
        data: {
          userId: id,
          title: "Account verified",
          body: "All required documents were approved. Your account is fully verified.",
          type: "DOCS_APPROVED",
        },
      });

      await prisma.adminActivityLog.create({
        data: {
          adminId: admin.id,
          action: "FINAL_APPROVE_CLIENT",
          entity: "User",
          entityId: id,
        },
      });

      return NextResponse.json({ user });
    }

    if (action === "GENERATE_AGREEMENT") {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

      let reservation = null as any;
      if (body.reservationId) {
        reservation = await prisma.reservation.findFirst({
          where: { id: body.reservationId, userId: id },
          include: { asset: true },
        });
      } else {
        reservation = await prisma.reservation.findFirst({
          where: { userId: id },
          include: { asset: true },
          orderBy: { createdAt: "desc" },
        });
      }

      const contractNumber = await nextContractNumber();
      const verifyToken = randomVerifyToken();
      const total =
        reservation?.installmentTotal || reservation?.asset?.price || Number(body.totalAmount) || 0;
      const paymentMethod = reservation?.paymentType || body.paymentMethod || "FULL";

      const pdfUrl = await buildAgreementPdf({
        contractNumber,
        verifyToken,
        clientName: user.name,
        clientEmail: user.email,
        clientPhone: user.phone,
        nin: user.nin,
        serviceTitle: reservation?.asset?.title || body.serviceTitle || "Construction service",
        paymentMethod,
        totalAmount: total,
        scheduleText: reservation?.scheduleJson
          ? `Frequency: ${reservation.installmentFrequency || "—"}\nDeadline: ${reservation.planDeadlineAt || "—"}`
          : undefined,
        rulesText: "Pay on schedule. Late payments may incur holds. See category rules in your plan.",
        cancelText: "Cancellation may deduct a category percentage of amounts paid.",
        signatureUrl: user.signatureUrl,
      });

      const contract = await prisma.contract.create({
        data: {
          contractNumber,
          verifyToken,
          userId: id,
          reservationId: reservation?.id || null,
          status: "ACTIVE",
          pdfUrl,
          clientName: user.name,
          serviceTitle: reservation?.asset?.title || body.serviceTitle || "Construction service",
          paymentMethod,
          totalAmount: total,
        },
      });

      await prisma.notification.create({
        data: {
          userId: id,
          title: "Agreement ready",
          body: `Your agreement letter (${contractNumber}) is ready to download under My Contracts.`,
          type: "AGREEMENT_READY",
        },
      });

      await prisma.adminActivityLog.create({
        data: {
          adminId: admin.id,
          action: "GENERATE_AGREEMENT",
          entity: "Contract",
          entityId: contract.id,
          details: JSON.stringify({ contractNumber }),
        },
      });

      return NextResponse.json({ contract });
    }

    if (action === "UPSERT_DOCUMENT") {
      if (body.documentId) {
        const doc = await prisma.userDocument.update({
          where: { id: body.documentId },
          data: {
            fileUrl: body.fileUrl ?? undefined,
            fileName: body.fileName ?? undefined,
            label: body.label ?? undefined,
            type: body.type ?? undefined,
            status: body.status ?? undefined,
            rejectReason: body.rejectReason ?? undefined,
          },
        });
        return NextResponse.json(doc);
      }
      const doc = await prisma.userDocument.create({
        data: {
          userId: id,
          type: body.type || "OTHER",
          label: body.label || null,
          fileUrl: body.fileUrl,
          fileName: body.fileName || null,
          status: body.status || "APPROVED",
        },
      });
      return NextResponse.json(doc, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Action failed" },
      { status: 500 }
    );
  }
}
