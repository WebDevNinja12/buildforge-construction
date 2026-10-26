import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

/** List users — never returns password hashes */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          reservations: true,
          toolRentals: true,
          hireRequests: true,
          projects: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}

/** Create user (admin) — password is bcrypt-hashed */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const body = await req.json();
    const { email, password, name, phone, role } = body;
    if (!email || !password || !name) {
      return NextResponse.json({ error: "email, password, name required" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "Email already exists" }, { status: 400 });

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        phone: phone || null,
        role: role === "ADMIN" ? "ADMIN" : "CLIENT",
      },
      select: { id: true, email: true, name: true, role: true, phone: true, createdAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
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

    // Clean related records that would block delete
    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { userId: id } });
      await tx.reservation.deleteMany({ where: { userId: id } });
      await tx.toolRental.deleteMany({ where: { userId: id } });
      await tx.hireRequest.deleteMany({ where: { userId: id } });
      const clientProjects = await tx.project.findMany({ where: { clientId: id }, select: { id: true } });
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
