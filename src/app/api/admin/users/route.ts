import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";
import { runMaintenance } from "@/lib/maintenance";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

/** List users with activity counts — never returns password */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  await runMaintenance();

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      status: true,
      agreedTermsAt: true,
      approvedAt: true,
      createdAt: true,
      _count: {
        select: {
          reservations: true,
          toolRentals: true,
          hireRequests: true,
          projects: true,
          payments: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

/** Create user (admin) — password bcrypt-hashed; can set APPROVED */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const body = await req.json();
    const { email, password, name, phone, role, status } = body;
    if (!email || !password || !name) {
      return NextResponse.json({ error: "email, password, name required" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "Email already exists" }, { status: 400 });

    const hashed = await hashPassword(password);
    const isAdmin = role === "ADMIN";
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        phone: phone || null,
        role: isAdmin ? "ADMIN" : "CLIENT",
        status: isAdmin ? "APPROVED" : status === "APPROVED" ? "APPROVED" : "PENDING_APPROVAL",
        agreedTermsAt: new Date(),
        approvedAt: isAdmin || status === "APPROVED" ? new Date() : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
      },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

/** Approve / reject client */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: "id and status required" }, { status: 400 });
    }
    if (!["APPROVED", "REJECTED", "PENDING_APPROVAL"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const user = await prisma.user.update({
      where: { id },
      data: {
        status,
        approvedAt: status === "APPROVED" ? new Date() : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        approvedAt: true,
      },
    });
    return NextResponse.json(user);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/** Delete any customer (not self) */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    if (id === admin.id) {
      return NextResponse.json({ error: "Cannot delete your own admin account" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { userId: id } });
      await tx.reservation.deleteMany({ where: { userId: id } });
      await tx.toolRental.deleteMany({ where: { userId: id } });
      await tx.hireRequest.deleteMany({ where: { userId: id } });
      const clientProjects = await tx.project.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      for (const p of clientProjects) {
        await tx.milestone.deleteMany({ where: { projectId: p.id } });
        await tx.payment.deleteMany({ where: { projectId: p.id } });
      }
      await tx.project.deleteMany({ where: { clientId: id } });
      await tx.project.updateMany({ where: { managerId: id }, data: { managerId: null } });
      await tx.user.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
