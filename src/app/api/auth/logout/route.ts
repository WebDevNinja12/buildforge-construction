import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST() {
  await clearSession();
  return NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_APP_URL || "https://buildforge-construction.vercel.app"),
    { status: 303 }
  );
}

export async function GET() {
  await clearSession();
  return NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_APP_URL || "https://buildforge-construction.vercel.app"),
    { status: 303 }
  );
}
