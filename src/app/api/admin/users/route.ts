import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { placeRegistrationCooldown } from "@/lib/registration-cooldown";

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
  } catch {
    /* */
  }
}

/** Fully remove a client and related records; free email for later re-use after cooldown. */
async function wipeClientData(userId: string) {
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.userDocument.deleteMany({ where: { userId } });
  await prisma.installmentDocument.deleteMany({ where: { userId } }).catch(() => null);
  await prisma.payment.deleteMany({ where: { userId } });
  await prisma.reservation.deleteMany({ where: { userId } });
  await prisma.toolRental.deleteMany({ where: { userId } });
  await prisma.hireRequest.deleteMany({ where: { userId } });
  // Projects owned as client — remove or detach
  await prisma.project.deleteMany({ where: { clientId: userId } }).catch(() => null);
  await prisma.user.delete({ where: { id: userId } });
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const status = searchParams.get("status");
  const includeArchived = searchParams.get("includeArchived") === "1";

  const where: any = { role: "CLIENT" };
  if (!includeArchived && status !== "ARCHIVED") {
    where.deletedAt = null;
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
        select: { reservations: true, payments: true, documents: true },
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
    const { email, password, name, phone, role, status } = body;
    if (!email || !password || !name) {
      return NextResponse.json({ error: "email, password, name required" }, { status: 400 });
    }
    const normalized = String(email).trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email: normalized } });
    if (exists) return NextResponse.json({ error: "Email already in use" }, { status: 400 });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email: normalized,
        password: hashed,
        name,
        phone: phone || null,
        role: role === "ADMIN" ? "ADMIN" : "CLIENT",
        status: status || "APPROVED",
        verificationStatus: status === "VERIFIED" ? "VERIFIED" : "PENDING",
        agreedTermsAt: new Date(),
        approvedAt: new Date(),
      },
    });
    await log(admin.id, "CREATE_CLIENT", user.id, user.email);
    const { password: _, ...safe } = user;
    return NextResponse.json(safe, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const body = await req.json();
    const { id, action, status, verificationNote, archiveReason, reservationAction } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (before.role === "ADMIN") {
      return NextResponse.json({ error: "Cannot modify admin via clients API" }, { status: 400 });
    }

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
      data.status = "ARCHIVED";
      data.archivedAt = new Date();
      data.archiveReason = archiveReason || "Archived by admin";
      data.deletedAt = new Date();
    } else if (action === "REQUEST_REUPLOAD") {
      data.verificationStatus = "REUPLOAD_REQUIRED";
      data.verificationNote = verificationNote || "Please re-upload required documents.";
    } else if (status) {
      data.status = status;
      if (["APPROVED", "UNDER_REVIEW"].includes(status)) {
        data.approvedAt = before.approvedAt || new Date();
      }
      if (status === "VERIFIED") {
        data.verificationStatus = "VERIFIED";
        data.verifiedAt = new Date();
      }
      if (status === "REJECTED") {
        data.status = "REJECTED";
      }
    }

    const user = await prisma.user.update({ where: { id }, data });

    await prisma.notification.create({
      data: {
        userId: id,
        title: "Account update",
        body: `Your account was updated by admin. Status: ${user.status} / ${user.verificationStatus}.`,
        type: "VERIFICATION",
        link: "/dashboard",
      },
    }).catch(() => null);

    await log(
      admin.id,
      action || "UPDATE_CLIENT",
      id,
      JSON.stringify({
        before: { status: before.status, verificationStatus: before.verificationStatus },
        after: data,
      })
    );

    const { password: _, ...safe } = user;
    return NextResponse.json(safe);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/**
 * DELETE client:
 * - Always wipes all related data (reservations, payments, docs, etc.)
 * - Places 72-hour cooldown on email + phone before the same details can register again
 * - After 72h, re-registration creates a brand-new user
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const reason = url.searchParams.get("reason") || "Removed by admin";
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (target.role === "ADMIN") {
      return NextResponse.json({ error: "Cannot delete admin" }, { status: 400 });
    }

    const email = target.email;
    const phone = target.phone;

    // Block re-use of same contact details for 72 hours
    const cooldown = await placeRegistrationCooldown({
      email,
      phone,
      reason,
    });

    await wipeClientData(id);

    await log(
      admin.id,
      "WIPE_DELETE_CLIENT",
      id,
      JSON.stringify({
        email,
        phone,
        reason,
        cooldownUntil: cooldown.expiresAt,
        hours: 72,
      })
    );

    return NextResponse.json({
      ok: true,
      wiped: true,
      message:
        "Customer and all related data removed. The same email/phone cannot register again for 72 hours. After that, registration is treated as a new user.",
      cooldownUntil: cooldown.expiresAt,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
