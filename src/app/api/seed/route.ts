import { NextResponse } from "next/server";

/** Demo seed endpoint disabled for production. */
export async function POST() {
  return NextResponse.json(
    {
      error: "Demo seed is disabled. Use POST /api/setup/admin with SETUP_SECRET to create your admin, then add real services in the admin panel.",
    },
    { status: 410 }
  );
}

export async function GET() {
  return POST();
}
