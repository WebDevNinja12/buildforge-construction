import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { healSchema } from "@/lib/schema-heal";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { id } = await params;

  try {
    await healSchema().catch(() => null);

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        verificationStatus: true,
        verificationNote: true,
        approvedAt: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
      },
    });
    if (!user || user.role === "ADMIN" || user.deletedAt) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Load each section independently so one missing column never blanks the profile
    const regDocs = await prisma.userDocument
      .findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } })
      .catch(() => []);

    const instDocs = await prisma.installmentDocument
      .findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } })
      .catch(() => []);

    let reservations: unknown[] = [];
    try {
      reservations = await prisma.reservation.findMany({
        where: { userId: id },
        include: { asset: true, payments: { orderBy: { createdAt: "desc" } } },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      reservations = await prisma.reservation
        .findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } })
        .catch(() => []);
    }

    const payments = await prisma.payment
      .findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 50 })
      .catch(() => []);

    const contracts = await prisma.contract
      .findMany({ where: { userId: id }, orderBy: { issuedAt: "desc" } })
      .catch(() => []);

    const logs = await prisma.adminActivityLog
      .findMany({
        where: {
          OR: [{ entityId: id }, { details: { contains: id } }],
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      })
      .catch(() => []);

    let toolRentals: unknown[] = [];
    try {
      toolRentals = await prisma.toolRental.findMany({
        where: { userId: id },
        include: { tool: true },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      toolRentals = await prisma.toolRental
        .findMany({ where: { userId: id }, orderBy: { createdAt: "desc" } })
        .catch(() => []);
    }

    let hires: unknown[] = [];
    try {
      hires = await prisma.hireRequest.findMany({
        where: { userId: id },
        include: { worker: true },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      // Missing HireRequest.total etc. — minimal select
      try {
        hires = await prisma.$queryRaw`
          SELECT id, "userId", "workerId", status, location, notes, "createdAt"
          FROM "HireRequest" WHERE "userId" = ${id}
          ORDER BY "createdAt" DESC
        `;
      } catch {
        hires = [];
      }
    }

    const typedIds = (instDocs as any[])
      .filter(
        (d) =>
          ["nin", "bvn", "NIN", "BVN", "valid_id"].includes(d.type) ||
          /nin|bvn/i.test(d.label || "")
      )
      .map((d) => ({
        type: d.type,
        label: d.label,
        value: d.textValue,
        status: d.status,
      }));

    return NextResponse.json({
      user: {
        ...user,
        // optional fields may not exist on older rows
        clientType: (user as any).clientType || "INDIVIDUAL",
        avatarUrl: (user as any).avatarUrl || null,
        signatureUrl: (user as any).signatureUrl || null,
      },
      registrationDocuments: regDocs,
      installmentDocuments: instDocs,
      typedIdentityFields: typedIds,
      reservations,
      payments,
      contracts,
      activity: logs,
      toolRentals,
      hireRequests: hires,
    });
  } catch (e) {
    console.error("client profile GET", e);
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

  try {
    await healSchema().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").toUpperCase();

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role === "ADMIN") {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (action === "VERIFY" || action === "FINAL_APPROVE") {
      await prisma.user.update({
        where: { id },
        data: {
          status: "APPROVED",
          verificationStatus: "VERIFIED",
          verifiedAt: new Date(),
          approvedAt: user.approvedAt || new Date(),
        },
      });
      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "CLIENT_VERIFY",
        entity: "User",
        entityId: id,
        details: { email: user.email },
        alsoNotifyEmails: [user.email],
      });
      return NextResponse.json({ ok: true, message: "Client verified" });
    }

    if (action === "UNVERIFY") {
      await prisma.user.update({
        where: { id },
        data: { verificationStatus: "UNDER_REVIEW" },
      });
      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "CLIENT_UNVERIFY",
        entity: "User",
        entityId: id,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "SUSPEND") {
      await prisma.user.update({
        where: { id },
        data: { status: "SUSPENDED" },
      });
      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "CLIENT_SUSPEND",
        entity: "User",
        entityId: id,
        alsoNotifyEmails: [user.email],
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "REACTIVATE" || action === "APPROVE") {
      await prisma.user.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedAt: new Date(),
          verificationStatus: user.verificationStatus === "PENDING" ? "UNDER_REVIEW" : user.verificationStatus,
        },
      });
      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "CLIENT_APPROVE",
        entity: "User",
        entityId: id,
        alsoNotifyEmails: [user.email],
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "UPDATE" || body.name || body.phone || body.status) {
      const data: Record<string, unknown> = {};
      if (body.name != null) data.name = String(body.name);
      if (body.phone != null) data.phone = String(body.phone);
      if (body.status != null) data.status = String(body.status);
      if (body.verificationStatus != null) data.verificationStatus = String(body.verificationStatus);
      if (body.verificationNote != null) data.verificationNote = String(body.verificationNote);
      await prisma.user.update({ where: { id }, data });
      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "CLIENT_UPDATE",
        entity: "User",
        entityId: id,
        details: data,
      });
      return NextResponse.json({ ok: true });
    }

    // Document batch review
    if (action === "REVIEW_DOCS" && Array.isArray(body.reviews)) {
      for (const r of body.reviews) {
        if (!r.id || !r.status) continue;
        try {
          await prisma.userDocument.update({
            where: { id: r.id },
            data: {
              status: r.status,
              rejectReason: r.status === "REJECTED" ? r.rejectReason || "Rejected" : null,
            },
          });
        } catch {
          try {
            await prisma.installmentDocument.update({
              where: { id: r.id },
              data: {
                status: r.status,
                rejectReason: r.status === "REJECTED" ? r.rejectReason || "Rejected" : null,
              },
            });
          } catch {
            /* */
          }
        }
      }
      await recordAdminActivity({
        adminId: admin.id,
        adminEmail: admin.email,
        adminName: admin.name,
        action: "CLIENT_REVIEW_DOCS",
        entity: "User",
        entityId: id,
        details: { count: body.reviews.length },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("client profile PATCH", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed" },
      { status: 500 }
    );
  }
}
