import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await clearSession();
  const accept = req.headers.get("accept") || "";
  if (accept.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://buildforge-construction.vercel.app");
  return NextResponse.redirect(new URL("/login", base), { status: 303 });
}

export async function GET(req: NextRequest) {
  await clearSession();
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://buildforge-construction.vercel.app");
  return NextResponse.redirect(new URL("/login", base), { status: 303 });
}
