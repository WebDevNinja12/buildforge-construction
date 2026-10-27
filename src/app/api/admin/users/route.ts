import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

async function log(adminId: string, action: string, entityId?: string, details?: string) {
  try {
    await prisma.adminActivityLog.create({
      data: { adminId, action, entity: "User", entityId, details },
    });
  } catch { /* */ }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const users = await prisma.user.findMany({
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
      createdAt: true,
      _count: {
        select: { reservations: true, toolRentals: true, hireRequests: true, documents: true },
      },
      documents: {
        select: { id: true, type: true, fileUrl: true, status: true, rejectReason: true, fileName: true },
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
        role: body.role || "CLIENT",
        status: body.status || "APPROVED",
        verificationStatus: body.verificationStatus || "VERIFIED",
        approvedAt: new Date(),
        verifiedAt: new Date(),
        agreedTermsAt: new Date(),
      },
    });
    await log(admin.id, "CREATE_USER", user.id, user.email);
    const { password: _, ...safe } = user;
    return NextResponse.json(safe, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    console.error(e);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

/**
 * PATCH body:
 * { id, status?, verificationStatus?, verificationNote?, action?: "FINAL_VERIFY" | "REQUEST_REUPLOAD" | "SUSPEND" }
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const body = await req.json();
    const { id, status, verificationStatus, verificationNote, action } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const data: Record<string, unknown> = {};

    if (action === "FINAL_VERIFY") {
      data.status = "VERIFIED";
      data.verificationStatus = "VERIFIED";
      data.verifiedAt = new Date();
      data.approvedAt = data.approvedAt || new Date();
    } else if (action === "SUSPEND") {
      data.status = "SUSPENDED";
    } else if (action === "REQUEST_REUPLOAD") {
      data.verificationStatus = "REUPLOAD_REQUIRED";
      data.verificationNote = verificationNote || "Please re-upload required documents.";
    } else {
      if (status) {
        data.status = status;
        if (status === "APPROVED" || status === "UNDER_REVIEW") {
          data.approvedAt = new Date();
          if (!verificationStatus) data.verificationStatus = "UNDER_REVIEW";
        }
        if (status === "VERIFIED") {
          data.verificationStatus = "VERIFIED";
          data.verifiedAt = new Date();
          data.approvedAt = new Date();
        }
        if (status === "REJECTED") {
          data.verificationStatus = "REJECTED";
          data.verificationNote = verificationNote || "Registration rejected.";
        }
      }
      if (verificationStatus) data.verificationStatus = verificationStatus;
      if (verificationNote != null) data.verificationNote = verificationNote;
    }

    const user = await prisma.user.update({ where: { id }, data });

    await prisma.notification.create({
      data: {
        userId: id,
        title: "Account status updated",
        body: `Your account status is now: ${user.verificationStatus || user.status}.${user.verificationNote ? " Note: " + user.verificationNote : ""}`,
        type: "VERIFICATION",
        link: "/dashboard",
      },
    });

    await log(admin.id, action || `STATUS_${status}`, id, JSON.stringify(data));
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
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (target.role === "ADMIN") return NextResponse.json({ error: "Cannot delete admin" }, { status: 400 });

    await prisma.notification.deleteMany({ where: { userId: id } });
    await prisma.userDocument.deleteMany({ where: { userId: id } });
    await prisma.payment.deleteMany({ where: { userId: id } });
    await prisma.reservation.deleteMany({ where: { userId: id } });
    await prisma.toolRental.deleteMany({ where: { userId: id } });
    await prisma.hireRequest.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    await log(admin.id, "DELETE_USER", id, target.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
