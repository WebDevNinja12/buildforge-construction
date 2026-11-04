import { NextResponse } from "next/server";

/** Demo seed endpoint permanently disabled — production uses real admin + real catalog only. */
export async function POST() {
  return NextResponse.json(
    {
      error: "Demo seed is disabled",
      message:
        "Add real services in Admin → Services, tools in Admin → Tools, workers in Admin → Workers. Create admin via env ADMIN_EMAIL / ADMIN_PASSWORD or Settings.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return POST();
}
