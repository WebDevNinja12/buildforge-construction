import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

/** List activity log */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") || 100), 500);

  const logs = await prisma.adminActivityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      admin: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ logs, count: logs.length });
}

/**
 * Clear history
 * DELETE ?all=1  → delete entire activity log
 * DELETE ?before=YYYY-MM-DD → delete entries older than date
 * DELETE ?id=xxx → delete one entry
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";
  const before = searchParams.get("before");
  const id = searchParams.get("id");

  try {
    if (id) {
      await prisma.adminActivityLog.delete({ where: { id } });
      await prisma.adminActivityLog.create({
        data: {
          adminId: admin.id,
          action: "CLEAR_LOG_ENTRY",
          entity: "AdminActivityLog",
          entityId: id,
          details: "Deleted single activity log entry",
        },
      });
      return NextResponse.json({ ok: true, deleted: 1 });
    }

    if (before) {
      const date = new Date(before);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "Invalid before date" }, { status: 400 });
      }
      const result = await prisma.adminActivityLog.deleteMany({
        where: { createdAt: { lt: date } },
      });
      await prisma.adminActivityLog.create({
        data: {
          adminId: admin.id,
          action: "CLEAR_LOG_BEFORE",
          entity: "AdminActivityLog",
          details: JSON.stringify({ before: date.toISOString(), deleted: result.count }),
        },
      });
      return NextResponse.json({ ok: true, deleted: result.count });
    }

    if (all) {
      const result = await prisma.adminActivityLog.deleteMany({});
      // Record that history was wiped (new single entry)
      await prisma.adminActivityLog.create({
        data: {
          adminId: admin.id,
          action: "CLEAR_ALL_HISTORY",
          entity: "AdminActivityLog",
          details: JSON.stringify({ deleted: result.count, at: new Date().toISOString() }),
        },
      });
      return NextResponse.json({ ok: true, deleted: result.count, message: "Activity history cleared" });
    }

    return NextResponse.json(
      { error: "Specify all=1, before=YYYY-MM-DD, or id=..." },
      { status: 400 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to clear history" }, { status: 500 });
  }
}
