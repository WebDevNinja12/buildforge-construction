import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { runMaintenance } from "./maintenance";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-me-in-production"
);

/** Cookie name — opaque session token only (never password, images, or documents). */
export const SESSION_COOKIE = "hama_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status?: string;
}

/** Minimal claims stored inside the signed JWT cookie */
type TokenClaims = {
  sub: string; // user id only
  role: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

/**
 * Create signed session token.
 * Payload is ONLY user id + role — never password, email body, images, or documents.
 * Profile fields are always loaded from the database on each request.
 */
export async function createToken(user: Pick<SessionUser, "id" | "role">): Promise<string> {
  return new SignJWT({
    sub: user.id,
    role: user.role,
  } satisfies TokenClaims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const id = (payload.sub as string) || (payload.id as string);
    const role = (payload.role as string) || "CLIENT";
    if (!id) return null;
    return { sub: id, role };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    await runMaintenance();
  } catch {
    /* ignore */
  }

  const cookieStore = await cookies();
  // Support legacy "session" cookie name during transition
  const token =
    cookieStore.get(SESSION_COOKIE)?.value || cookieStore.get("session")?.value;
  if (!token) return null;

  const claims = await verifyToken(token);
  if (!claims) return null;

  // Always hydrate from DB — cookie never holds email/name/password/images
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      deletedAt: true,
    },
  });
  if (!user || user.deletedAt) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}

/**
 * Set httpOnly session cookie.
 * - No password
 * - No images / videos / documents
 * - No PII beyond signed user id + role inside JWT
 */
export async function setSession(user: Pick<SessionUser, "id" | "role">) {
  const token = await createToken({ id: user.id, role: user.role });
  const cookieStore = await cookies();
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    process.env.COOKIE_SECURE === "true";

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable by JS — blocks XSS theft
    secure,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  // Clear legacy cookie if present
  cookieStore.delete("session");
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete("session");
}

export async function ensureAdminFromEnv(): Promise<boolean> {
  const email = (process.env.ADMIN_EMAIL || "admin@buildforge.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "HamaAdmin2026!";
  if (!email || !password) return false;

  const existing = await prisma.user.findUnique({ where: { email } });
  const hashed = await hashPassword(password);
  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "ADMIN",
          status: "APPROVED",
          verificationStatus: "VERIFIED",
          password: hashed,
        },
      });
    } else {
      // Keep env password in sync for bootstrap accounts
      await prisma.user.update({
        where: { id: existing.id },
        data: { password: hashed, status: "APPROVED", verificationStatus: "VERIFIED" },
      });
    }
    return true;
  }

  await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: "Hama Admin",
      role: "ADMIN",
      status: "APPROVED",
      verificationStatus: "VERIFIED",
      agreedTermsAt: new Date(),
      approvedAt: new Date(),
      verifiedAt: new Date(),
    },
  });
  return true;
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone?: string
) {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) throw new Error("Email already registered");
  const hashed = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalized,
      password: hashed,
      name,
      phone,
      role: "CLIENT",
      status: "PENDING_APPROVAL",
      verificationStatus: "UNDER_REVIEW",
      agreedTermsAt: new Date(),
    },
  });
  // Never return password hash to callers
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}

export async function loginUser(
  email: string,
  password: string,
  options?: { requireRole?: "ADMIN" | "CLIENT" }
) {
  try {
    await runMaintenance();
  } catch {
    /* ignore */
  }

  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) throw new Error("Invalid email or password");

  const valid = await verifyPassword(password, user.password);
  if (!valid) throw new Error("Invalid email or password");

  if (user.deletedAt) throw new Error("Invalid email or password");

  if (user.status === "REJECTED" || user.status === "SUSPENDED") {
    throw new Error(
      user.status === "SUSPENDED"
        ? "Your account is suspended. Contact support."
        : "Your account was not approved. Contact support."
    );
  }

  if (options?.requireRole === "ADMIN" && user.role !== "ADMIN") {
    throw new Error("This portal is for administrators only. Use the client login.");
  }
  if (options?.requireRole === "CLIENT" && user.role === "ADMIN") {
    throw new Error("Administrators must sign in at /admin/login");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}
