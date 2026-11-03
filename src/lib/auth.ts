import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "hama-construction-dev-secret-change-me"
);

export const SESSION_COOKIE = "hama_session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  verificationStatus?: string;
}

export const DEFAULT_ADMIN_EMAIL = "admin@hamaconstruction.com";
export const DEFAULT_ADMIN_PASSWORD = "HamaAdmin2026!";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(user: Pick<SessionUser, "id" | "role">): Promise<string> {
  return new SignJWT({ id: user.id, role: user.role, sub: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ sub: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sub = String(payload.sub || payload.id || "");
    const role = String(payload.role || "");
    if (!sub || !role) return null;
    return { sub, role };
  } catch {
    return null;
  }
}

/** Safe user columns only — never SELECT nin/bvn (installment-doc fields only) */
const USER_SAFE = {
  id: true,
  email: true,
  password: true,
  name: true,
  role: true,
  status: true,
  verificationStatus: true,
  deletedAt: true,
} as const;

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(SESSION_COOKIE)?.value || cookieStore.get("session")?.value;
  if (!token) return null;
  const claims = await verifyToken(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      verificationStatus: true,
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
    verificationStatus: user.verificationStatus || undefined,
  };
}

export async function requireApproved(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  if (["REJECTED", "SUSPENDED", "ARCHIVED"].includes(session.status)) {
    throw new Error("Account not allowed");
  }
  return session;
}

export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") throw new Error("Admin only");
  return session;
}

export async function setSession(user: Pick<SessionUser, "id" | "role">) {
  const token = await createToken(user);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete("session");
}

export async function ensureAdminFromEnv(): Promise<boolean> {
  const email = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  if (!email || !password) return false;

  const hashed = await hashPassword(password);
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        status: "APPROVED",
        verificationStatus: "VERIFIED",
        password: hashed,
      },
    });
    return true;
  }

  await prisma.user.create({
    data: {
      email,
      password: hashed,
      name: process.env.ADMIN_NAME?.trim() || "Hama Admin",
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
  const existing = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, deletedAt: true },
  });
  if (existing) {
    if (existing.deletedAt) {
      throw new Error("This email cannot be used right now. Contact support if this persists.");
    }
    throw new Error("Email already registered");
  }

  const hashed = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: normalized,
      password: hashed,
      name,
      phone: phone || null,
      role: "CLIENT",
      status: "PENDING_APPROVAL",
      verificationStatus: "UNDER_REVIEW",
      agreedTermsAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });
  return user;
}

export async function loginUser(
  email: string,
  password: string,
  options?: { requireRole?: "ADMIN" | "CLIENT" }
) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: {
      id: true,
      email: true,
      password: true,
      name: true,
      role: true,
      status: true,
      deletedAt: true,
    },
  });
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
