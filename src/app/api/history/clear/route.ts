import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * Client clears personal history:
 * - deletes notifications
 * - stores historyClearedAt in SiteSetting so completed/cancelled items hide on dashboard
 * Active holds (PENDING / INSTALLMENT_PLAN / CONFIRMED) are never removed.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "ADMIN") {
    return NextResponse.json(
      { error: "Admins use Admin panel filters; clients clear their own history here." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const clearNotifications = body.clearNotifications !== false;
  const hideCompleted = body.hideCompleted !== false;

  let deletedNotifications = 0;
  if (clearNotifications) {
    const r = await prisma.notification.deleteMany({ where: { userId: session.id } });
    deletedNotifications = r.count;
  }

  if (hideCompleted) {
    const key = `history_cleared_at_${session.id}`;
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value: new Date().toISOString() },
      create: { key, value: new Date().toISOString() },
    });
  }

  await prisma.adminActivityLog
    .create({
      data: {
        adminId: session.id,
        action: "CLIENT_CLEAR_HISTORY",
        entity: "User",
        entityId: session.id,
        details: JSON.stringify({ deletedNotifications, hideCompleted }),
      },
    })
    .catch(() => null);

  return NextResponse.json({
    ok: true,
    deletedNotifications,
    hideCompleted,
    message:
      "History cleared. Active reservations stay visible. Completed/cancelled items are hidden. Notifications removed.",
  });
}
