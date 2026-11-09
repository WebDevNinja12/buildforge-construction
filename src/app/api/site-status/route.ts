import { NextResponse } from "next/server";
import { getSiteAccessMode } from "@/lib/site-mode";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const mode = await getSiteAccessMode();
    return NextResponse.json({
      maintenanceMode: mode.maintenanceMode,
      lockClientLogin: mode.lockClientLogin,
      lockRegistration: mode.lockRegistration,
      message: mode.message,
    });
  } catch {
    return NextResponse.json({
      maintenanceMode: false,
      lockClientLogin: false,
      lockRegistration: false,
      message: "",
    });
  }
}
