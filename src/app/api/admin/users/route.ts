import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

async function log(
  adminId: string,
  action: string,
  entityId?: string,
  details?: string
) {
  try {
    await prisma.adminActivityLog.create({
      data: { adminId, action, entity: "User", entityId, details },
    });
  } catch { /* */ }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const status = searchParams.get("status"); // UNDER_REVIEW | VERIFIED | SUSPENDED | ARCHIVED | ALL
  const includeArchived = searchParams.get("includeArchived") === "1";

  const where: any = { role: "CLIENT" };
  if (!includeArchived && status !== "ARCHIVED") {
    where.deletedAt = null;
    where.OR = [{ archivedAt: null }, { status: { not: "ARCHIVED" } }];
  }
  if (status && status !== "ALL") {
    if (status === "UNDER_REVIEW") {
      where.OR = [
        { status: "UNDER_REVIEW" },
        { status: "PENDING_APPROVAL" },
        { verificationStatus: "UNDER_REVIEW" },
        { verificationStatus: "PENDING" },
      ];
    } else if (status === "VERIFIED") {
      where.verificationStatus = "VERIFIED";
    } else if (status === "SUSPENDED") {
      where.status = "SUSPENDED";
    } else if (status === "ARCHIVED") {
      where.OR = [{ status: "ARCHIVED" }, { archivedAt: { not: null } }];
    } else {
      where.status = status;
    }
  }
  if (q) {
    where.AND = [
      {
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
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
      archivedAt: true,
      archiveReason: true,
      deletedAt: true,
      createdAt: true,
      _count: {
        select: {
          reservations: true,
          toolRentals: true,
          hireRequests: true,
          documents: true,
          payments: true,
        },
      },
      documents: {
        select: {
          id: true,
          type: true,
          fileUrl: true,
          status: true,
          rejectReason: true,
          fileName: true,
          label: true,
        },
      },
      reservations: {
        where: {
          status: {
            in: ["PENDING", "CONFIRMED", "INSTALLMENT_PLAN", "PARTIALLY_PAID"],
          },
        },
        select: { id: true, status: true, amountPaid: true, totalAmount: true },
        take: 10,
      },
    },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const body = await req.json();
    if (!body.email || !body.password || !body.name) {
      return NextResponse.json({ error: "name, email, password required" }, { status: 400 });
    }
    const hash = await bcrypt.hash(body.password, 12);
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase().trim(),
        password: hash,
        name: body.name,
        phone: body.phone || null,
        role: "CLIENT",
        status: body.status || "APPROVED",
        verificationStatus: body.verificationStatus || "VERIFIED",
        approvedAt: new Date(),
        verifiedAt: body.verificationStatus === "VERIFIED" || !body.verificationStatus ? new Date() : null,
        agreedTermsAt: new Date(),
      },
    });
    await log(admin.id, "CREATE_CLIENT", user.id, JSON.stringify({ email: user.email, name: user.name }));
    const { password: _, ...safe } = user;
    return NextResponse.json(safe, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      id,
      status,
      verificationStatus,
      verificationNote,
      action,
      name,
      phone,
      email,
      password,
      archiveReason,
      reservationAction,
    } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (before.role === "ADMIN") return NextResponse.json({ error: "Cannot modify admin via clients API" }, { status: 400 });

    const data: Record<string, unknown> = {};

    if (action === "FINAL_VERIFY" || action === "VERIFY") {
      data.status = "VERIFIED";
      data.verificationStatus = "VERIFIED";
      data.verifiedAt = new Date();
      data.approvedAt = before.approvedAt || new Date();
    } else if (action === "UNVERIFY") {
      data.verificationStatus = "UNDER_REVIEW";
      data.status = "UNDER_REVIEW";
      data.verifiedAt = null;
    } else if (action === "SUSPEND") {
      data.status = "SUSPENDED";
    } else if (action === "REACTIVATE") {
      data.status = "APPROVED";
      data.archivedAt = null;
      data.archiveReason = null;
      data.deletedAt = null;
    } else if (action === "ARCHIVE" || action === "SOFT_DELETE") {
      const activeRes = await prisma.reservation.count({
        where: {
          userId: id,
          status: { in: ["PENDING", "CONFIRMED", "INSTALLMENT_PLAN", "PARTIALLY_PAID"] },
        },
      });
      if (activeRes > 0 && !reservationAction) {
        return NextResponse.json(
          {
            error: "Client has active reservations or installment plans",
            activeReservations: activeRes,
            requiresChoice: true,
            options: ["CANCEL_PLANS", "KEEP_UNTIL_COMPLETE", "TRANSFER"],
          },
          { status: 409 }
        );
      }
      if (reservationAction === "CANCEL_PLANS") {
        await prisma.reservation.updateMany({
          where: {
            userId: id,
            status: { in: ["PENDING", "CONFIRMED", "INSTALLMENT_PLAN", "PARTIALLY_PAID"] },
          },
          data: { status: "CANCELLED", cancelReason: "Client archived by admin" },
        });
      }
      data.status = "ARCHIVED";
      data.archivedAt = new Date();
      data.archiveReason = archiveReason || "Archived by admin";
    } else if (action === "REQUEST_REUPLOAD") {
      data.verificationStatus = "REUPLOAD_REQUIRED";
      data.verificationNote = verificationNote || "Please re-upload required documents.";
    } else {
      if (status) {
        data.status = status;
        if (["APPROVED", "UNDER_REVIEW"].includes(status)) {
          data.approvedAt = before.approvedAt || new Date();
        }
        if (status === "VERIFIED") {
          data.verificationStatus = "VERIFIED";
          data.verifiedAt = new Date();
        }
        if (status === "REJECTED") {
          data.verificationStatus = "REJECTED";
          data.verificationNote = verificationNote || "Registration rejected.";
        }
        if (status === "SUSPENDED") data.status = "SUSPENDED";
      }
      if (verificationStatus) data.verificationStatus = verificationStatus;
      if (verificationNote != null) data.verificationNote = verificationNote;
    }

    if (name != null) data.name = name;
    if (phone != null) data.phone = phone;
    if (email != null) data.email = String(email).toLowerCase().trim();
    if (password) data.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({ where: { id }, data });

    await prisma.notification.create({
      data: {
        userId: id,
        title: "Account updated",
        body: `Your account was updated by admin. Status: ${user.status} / ${user.verificationStatus}.`,
        type: "VERIFICATION",
        link: "/dashboard",
      },
    }).catch(() => null);

    await log(
      admin.id,
      action || "UPDATE_CLIENT",
      id,
      JSON.stringify({ before: { status: before.status, verificationStatus: before.verificationStatus, name: before.name }, after: data })
    );

    const { password: _, ...safe } = user;
    return NextResponse.json(safe);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const permanent = url.searchParams.get("permanent") === "1";
    const reason = url.searchParams.get("reason") || "Removed by admin";
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (target.role === "ADMIN") return NextResponse.json({ error: "Cannot delete admin" }, { status: 400 });

    if (!permanent) {
      // Soft delete = archive
      const user = await prisma.user.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          archivedAt: new Date(),
          archiveReason: reason,
          deletedAt: new Date(),
        },
      });
      await log(admin.id, "SOFT_DELETE_CLIENT", id, reason);
      return NextResponse.json({ ok: true, softDeleted: true, user });
    }

    await prisma.notification.deleteMany({ where: { userId: id } });
    await prisma.userDocument.deleteMany({ where: { userId: id } });
    await prisma.payment.deleteMany({ where: { userId: id } });
    await prisma.reservation.deleteMany({ where: { userId: id } });
    await prisma.toolRental.deleteMany({ where: { userId: id } });
    await prisma.hireRequest.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    await log(admin.id, "PERMANENT_DELETE_CLIENT", id, `${target.email}: ${reason}`);
    return NextResponse.json({ ok: true, permanent: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
