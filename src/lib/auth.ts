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

interface TokenClaims {
  id: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(
  user: Pick<SessionUser, "id" | "role">
): Promise<string> {
  return new SignJWT({ id: user.id, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<TokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.id || !payload.role) return null;
    return { id: String(payload.id), role: String(payload.role) };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyToken(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.id },
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
    verificationStatus: user.verificationStatus,
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
  if (!session || session.role !== "ADMIN") {
    throw new Error("Admin only");
  }
  return session;
}

export async function setSession(user: Pick<SessionUser, "id" | "role">) {
  const token = await createToken(user);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Default admin — override with ADMIN_EMAIL / ADMIN_PASSWORD env vars */
export const DEFAULT_ADMIN_EMAIL = "admin@hamaconstruction.com";
export const DEFAULT_ADMIN_PASSWORD = "HamaAdmin2026!";

export async function ensureAdminFromEnv(): Promise<boolean> {
  const email = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  if (!email || !password) return false;

  const hashed = await hashPassword(password);

  // Migrate legacy admin email if present
  const legacy = await prisma.user.findUnique({
    where: { email: "admin@buildforge.com" },
  });
  if (legacy && email !== "admin@buildforge.com") {
    const conflict = await prisma.user.findUnique({ where: { email } });
    if (!conflict) {
      await prisma.user.update({
        where: { id: legacy.id },
        data: {
          email,
          password: hashed,
          role: "ADMIN",
          status: "APPROVED",
          verificationStatus: "VERIFIED",
          name: legacy.name || "Hama Admin",
        },
      });
      return true;
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
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
  extra?: { phone?: string; clientType?: string; agreedTerms?: boolean }
) {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) throw new Error("Email already registered");

  // 72h cooldown after admin delete
  const cooldown = await prisma.siteSetting.findUnique({
    where: { key: `cooldown:${normalized}` },
  });
  if (cooldown?.value) {
    const until = new Date(cooldown.value);
    if (until > new Date()) {
      throw new Error("This email cannot be reused yet. Try again later.");
    }
  }

  const hashed = await hashPassword(password);
  return prisma.user.create({
    data: {
      email: normalized,
      password: hashed,
      name: name.trim(),
      phone: extra?.phone || null,
      clientType: extra?.clientType || "INDIVIDUAL",
      role: "CLIENT",
      status: "PENDING_APPROVAL",
      verificationStatus: "UNDER_REVIEW",
      agreedTermsAt: extra?.agreedTerms ? new Date() : null,
    },
  });
}

export async function loginUser(
  email: string,
  password: string,
  opts?: { requireRole?: string }
) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || user.deletedAt) throw new Error("Invalid email or password");
  const ok = await verifyPassword(password, user.password);
  if (!ok) throw new Error("Invalid email or password");
  if (opts?.requireRole && user.role !== opts.requireRole) {
    throw new Error("Invalid email or password");
  }
  if (["SUSPENDED", "ARCHIVED"].includes(user.status)) {
    throw new Error("Account suspended");
  }
  return user;
}
