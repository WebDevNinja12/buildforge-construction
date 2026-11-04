import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const workers = await prisma.worker.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json(workers);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load workers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const specialty = String(body.specialty || body.skill || "").trim();
    const experience = Number(body.experience ?? 0);
    const dailyRate = Number(body.dailyRate ?? body.rate ?? 0);
    const location = body.location ? String(body.location).trim() : null;
    const bio = body.bio ? String(body.bio).trim() : null;
    const image = body.image || body.imageUrl || null;
    const skills = body.skills
      ? typeof body.skills === "string"
        ? body.skills
        : JSON.stringify(body.skills)
      : null;
    const rating = body.rating != null ? Number(body.rating) : 5;
    const active = body.active !== false;

    if (!name || !specialty || !Number.isFinite(dailyRate) || dailyRate < 0) {
      return NextResponse.json(
        { error: "Name, specialty/skill, and daily rate are required" },
        { status: 400 }
      );
    }

    const worker = await prisma.worker.create({
      data: {
        name,
        specialty,
        experience: Number.isFinite(experience) ? experience : 0,
        dailyRate,
        rating: Number.isFinite(rating) ? rating : 5,
        bio,
        image,
        location,
        skills,
        active,
      },
    });

    await prisma.adminActivityLog
      .create({
        data: {
          adminId: admin.id,
          action: "WORKER_CREATE",
          entity: "Worker",
          entityId: worker.id,
          details: JSON.stringify({ name, specialty, dailyRate }),
        },
      })
      .catch(() => null);

    return NextResponse.json(worker, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create worker" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (body.name != null) data.name = String(body.name).trim();
    if (body.specialty != null || body.skill != null)
      data.specialty = String(body.specialty || body.skill).trim();
    if (body.experience != null) data.experience = Number(body.experience);
    if (body.dailyRate != null || body.rate != null)
      data.dailyRate = Number(body.dailyRate ?? body.rate);
    if (body.location != null) data.location = String(body.location).trim() || null;
    if (body.bio != null) data.bio = String(body.bio).trim() || null;
    if (body.image != null || body.imageUrl != null) data.image = body.image || body.imageUrl || null;
    if (body.skills != null)
      data.skills =
        typeof body.skills === "string" ? body.skills : JSON.stringify(body.skills);
    if (body.active != null) data.active = Boolean(body.active);
    if (body.rating != null) data.rating = Number(body.rating);

    const worker = await prisma.worker.update({ where: { id }, data });

    await prisma.adminActivityLog
      .create({
        data: {
          adminId: admin.id,
          action: "WORKER_UPDATE",
          entity: "Worker",
          entityId: id,
          details: JSON.stringify(data),
        },
      })
      .catch(() => null);

    return NextResponse.json(worker);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update worker" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Soft-deactivate related hires (workerId is required on HireRequest)
    await prisma.hireRequest.updateMany({
      where: { workerId: id, status: { in: ["PENDING", "ACTIVE", "RESERVED"] } },
      data: { status: "CANCELLED" },
    });

    // Soft delete preferred: keep history
    const soft = new URL(req.url).searchParams.get("hard") === "1";
    if (soft) {
      await prisma.workerReview.deleteMany({ where: { workerId: id } }).catch(() => null);
      await prisma.hireRequest.deleteMany({ where: { workerId: id } }).catch(() => null);
      await prisma.worker.delete({ where: { id } });
    } else {
      await prisma.worker.update({
        where: { id },
        data: { active: false },
      });
    }

    await prisma.adminActivityLog
      .create({
        data: {
          adminId: admin.id,
          action: soft ? "WORKER_DELETE_HARD" : "WORKER_DEACTIVATE",
          entity: "Worker",
          entityId: id,
          details: JSON.stringify({ hard: soft }),
        },
      })
      .catch(() => null);

    return NextResponse.json({ ok: true, hard: soft });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to remove worker" },
      { status: 500 }
    );
  }
}
