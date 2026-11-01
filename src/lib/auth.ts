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

export const DEFAULT_ADMIN_EMAIL = "admin@hamaconstruction.com";
export const DEFAULT_ADMIN_PASSWORD = "HamaAdmin2026!";

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

/** Raw lookup — only columns that exist on older DBs (avoids User.nin schema drift) */
async function findUserByEmailRaw(email: string) {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      email: string;
      password: string;
      name: string;
      role: string;
      status: string;
      verificationStatus: string | null;
      deletedAt: Date | null;
    }[]
  >`
    SELECT id, email, password, name, role, status,
           "verificationStatus", "deletedAt"
    FROM "User"
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;
  return rows[0] || null;
}

async function findUserByIdRaw(id: string) {
  const rows = await prisma.$queryRaw<
    {
      id: string;
      email: string;
      name: string;
      role: string;
      status: string;
      verificationStatus: string | null;
      deletedAt: Date | null;
    }[]
  >`
    SELECT id, email, name, role, status, "verificationStatus", "deletedAt"
    FROM "User"
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyToken(token);
  if (!claims) return null;

  try {
    const user = await findUserByIdRaw(claims.id);
    if (!user || user.deletedAt) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      verificationStatus: user.verificationStatus || undefined,
    };
  } catch (e) {
    console.error("getSession", e);
    return null;
  }
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

function cuidLike() {
  return (
    "c" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 8)
  );
}

export async function ensureAdminFromEnv(): Promise<boolean> {
  const email = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  if (!email || !password) return false;

  const hashed = await hashPassword(password);
  const name = process.env.ADMIN_NAME?.trim() || "Hama Admin";
  const now = new Date();

  // Migrate legacy email if present
  try {
    const legacy = await findUserByEmailRaw("admin@buildforge.com");
    if (legacy && email !== "admin@buildforge.com") {
      const conflict = await findUserByEmailRaw(email);
      if (!conflict) {
        await prisma.$executeRaw`
          UPDATE "User"
          SET email = ${email},
              password = ${hashed},
              role = 'ADMIN',
              status = 'APPROVED',
              "verificationStatus" = 'VERIFIED',
              name = ${name},
              "updatedAt" = ${now}
          WHERE id = ${legacy.id}
        `;
        return true;
      }
    }
  } catch (e) {
    console.error("legacy admin migrate", e);
  }

  const existing = await findUserByEmailRaw(email);
  if (existing) {
    await prisma.$executeRaw`
      UPDATE "User"
      SET password = ${hashed},
          role = 'ADMIN',
          status = 'APPROVED',
          "verificationStatus" = 'VERIFIED',
          name = ${name},
          "updatedAt" = ${now}
      WHERE id = ${existing.id}
    `;
    return true;
  }

  const id = cuidLike();
  await prisma.$executeRaw`
    INSERT INTO "User" (
      id, email, password, name, role, status, "verificationStatus",
      "clientType", "createdAt", "updatedAt", "approvedAt", "verifiedAt", "agreedTermsAt"
    ) VALUES (
      ${id}, ${email}, ${hashed}, ${name}, 'ADMIN', 'APPROVED', 'VERIFIED',
      'INDIVIDUAL', ${now}, ${now}, ${now}, ${now}, ${now}
    )
  `;
  return true;
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  extra?: { phone?: string; clientType?: string; agreedTerms?: boolean }
) {
  const normalized = email.trim().toLowerCase();
  const existing = await findUserByEmailRaw(normalized);
  if (existing) throw new Error("Email already registered");

  try {
    const cooldown = await prisma.siteSetting.findUnique({
      where: { key: `cooldown:${normalized}` },
    });
    if (cooldown?.value) {
      const until = new Date(cooldown.value);
      if (until > new Date()) {
        throw new Error("This email cannot be reused yet. Try again later.");
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("cannot be reused")) throw e;
  }

  const hashed = await hashPassword(password);
  const id = cuidLike();
  const now = new Date();
  const phone = extra?.phone || null;
  const clientType = extra?.clientType || "INDIVIDUAL";
  const agreed = extra?.agreedTerms ? now : null;

  await prisma.$executeRaw`
    INSERT INTO "User" (
      id, email, password, name, phone, role, status, "verificationStatus",
      "clientType", "createdAt", "updatedAt", "agreedTermsAt"
    ) VALUES (
      ${id}, ${normalized}, ${hashed}, ${name.trim()}, ${phone},
      'CLIENT', 'PENDING_APPROVAL', 'UNDER_REVIEW',
      ${clientType}, ${now}, ${now}, ${agreed}
    )
  `;

  const user = await findUserByEmailRaw(normalized);
  if (!user) throw new Error("Registration failed");
  return user;
}

export async function loginUser(
  email: string,
  password: string,
  opts?: { requireRole?: string }
) {
  const normalized = email.trim().toLowerCase();
  const user = await findUserByEmailRaw(normalized);
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
