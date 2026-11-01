import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "hama_session";

async function roleFromRequest(req: NextRequest): Promise<string | null> {
  const token =
    req.cookies.get(SESSION_COOKIE)?.value || req.cookies.get("session")?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || "fallback-secret-change-me-in-production"
    );
    const { payload } = await jwtVerify(token, secret);
    return (payload.role as string) || null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Protect all /admin routes except login
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const role = await roleFromRequest(req);
    if (!role) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Clients only on /dashboard — admins go to /admin
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const role = await roleFromRequest(req);
    if (role === "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard", "/dashboard/:path*"],
};
