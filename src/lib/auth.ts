import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { runMaintenance } from "./maintenance";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-me-in-production"
);

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status?: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status || "APPROVED",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
      status: (payload.status as string) || "APPROVED",
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    await runMaintenance();
  } catch {
    // never block session on maintenance failure
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  const session = await verifyToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, role: true, status: true },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}

export async function setSession(user: SessionUser) {
  const token = await createToken(user);
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export async function requireAuth(roles?: string[]) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  if (roles && !roles.includes(session.role)) throw new Error("Forbidden");
  return session;
}

export async function requireApproved() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  if (session.role === "ADMIN") return session;
  const ok = ["APPROVED", "UNDER_REVIEW", "VERIFIED"].includes(session.status || "");
  if (!ok) throw new Error("Account pending approval");
  return session;
}

/** Create/update admin from ADMIN_EMAIL + ADMIN_PASSWORD env vars. */
export async function ensureAdminFromEnv(): Promise<boolean> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrator";
  if (!email || !password || password.length < 8) {
    console.warn("ensureAdminFromEnv: ADMIN_EMAIL or ADMIN_PASSWORD missing");
    return false;
  }
  try {
    const hashed = await hashPassword(password);
    await prisma.user.upsert({
      where: { email },
      update: {
        password: hashed,
        name,
        role: "ADMIN",
        status: "APPROVED",
        verificationStatus: "VERIFIED",
        approvedAt: new Date(),
        verifiedAt: new Date(),
      },
      create: {
        email,
        password: hashed,
        name,
        role: "ADMIN",
        status: "APPROVED",
        verificationStatus: "VERIFIED",
        approvedAt: new Date(),
        verifiedAt: new Date(),
        agreedTermsAt: new Date(),
      },
    });
    return true;
  } catch (e) {
    console.error("ensureAdminFromEnv failed", e);
    return false;
  }
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone?: string,
  agreedTerms?: boolean
) {
  if (!agreedTerms) {
    throw new Error("You must agree to the terms and rules before registering");
  }
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
    throw new Error("Administrators must sign in at the Admin Login page.");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}
