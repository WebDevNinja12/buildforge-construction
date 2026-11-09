import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSiteAccessMode, setSiteAccessMode } from "@/lib/site-mode";
import { recordAdminActivity } from "@/lib/admin-activity";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const mode = await getSiteAccessMode();
  return NextResponse.json(mode);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  try {
    const body = await req.json().catch(() => ({}));
    const mode = await setSiteAccessMode({
      maintenanceMode:
        body.maintenanceMode !== undefined ? Boolean(body.maintenanceMode) : undefined,
      lockClientLogin:
        body.lockClientLogin !== undefined ? Boolean(body.lockClientLogin) : undefined,
      lockRegistration:
        body.lockRegistration !== undefined ? Boolean(body.lockRegistration) : undefined,
      message: body.message !== undefined ? String(body.message) : undefined,
    });

    await recordAdminActivity({
      adminId: admin.id,
      adminEmail: admin.email,
      adminName: admin.name,
      action: mode.maintenanceMode ? "MAINTENANCE_ON" : "MAINTENANCE_OFF",
      entity: "SiteSetting",
      entityId: "maintenance_mode",
      details: mode,
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      ...mode,
      message: mode.maintenanceMode
        ? "Maintenance mode is ON — client login/registration locked as configured."
        : "Maintenance mode is OFF — client access follows individual lock switches.",
    });
  } catch (e) {
    console.error("site-mode POST", e);
    return NextResponse.json(
      { error: "Failed to update site mode", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
