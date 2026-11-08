import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import type { AccountType, ContactPerson, DirectorInput } from "@/lib/registration";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "hama-construction-dev-secret"
);

export const SESSION_COOKIE = "hama_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  verificationStatus?: string;
};

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
    verificationStatus: user.verificationStatus,
  };
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

export async function loginUser(
  email: string,
  password: string,
  opts?: { requireRole?: "ADMIN" | "CLIENT" }
) {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || user.deletedAt) throw new Error("Invalid email or password");
  const ok = await verifyPassword(password, user.password);
  if (!ok) throw new Error("Invalid email or password");

  if (opts?.requireRole === "CLIENT" && user.role === "ADMIN") {
    throw new Error("Administrators must sign in at the staff login page.");
  }
  if (opts?.requireRole === "ADMIN" && user.role !== "ADMIN") {
    throw new Error("Admin credentials required");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}

export type RegisterInput = {
  email: string;
  password: string;
  name: string;
  phone?: string;
  clientType?: AccountType;
  address?: string;
  nin?: string;
  bvn?: string;
  companyRc?: string;
  companyTin?: string;
  contactPerson?: ContactPerson;
  directors?: DirectorInput[];
  agreedTerms?: boolean;
  documents?: Array<{ type: string; label?: string; fileUrl: string; fileName?: string }>;
};

async function healRegistrationColumns() {
  for (const sql of [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "clientType" TEXT DEFAULT 'INDIVIDUAL'`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "address" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nin" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "bvn" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyRc" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyTin" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyProfileJson" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "agreedTermsAt" TIMESTAMP(3)`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* */
    }
  }
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone?: string,
  agreedTerms?: boolean,
  extra?: Omit<RegisterInput, "email" | "password" | "name" | "phone" | "agreedTerms">
) {
  await healRegistrationColumns();

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

  const clientType: AccountType = extra?.clientType === "COMPANY" ? "COMPANY" : "INDIVIDUAL";
  const nin = extra?.nin ? String(extra.nin).replace(/\D/g, "") : null;
  const bvn = extra?.bvn ? String(extra.bvn).replace(/\D/g, "") : null;
  const companyRc = extra?.companyRc ? String(extra.companyRc).trim().toUpperCase() : null;
  const companyTin = extra?.companyTin ? String(extra.companyTin).trim() : null;

  // Duplicate identity checks
  if (nin) {
    const hit = await prisma.user.findFirst({
      where: { nin, deletedAt: null },
      select: { id: true },
    });
    if (hit) throw new Error("This NIN is already registered to another account");
  }
  if (bvn) {
    const hit = await prisma.user.findFirst({
      where: { bvn, deletedAt: null },
      select: { id: true },
    });
    if (hit) throw new Error("This BVN is already registered to another account");
  }
  if (companyRc) {
    try {
      const hit = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE "companyRc" = ${companyRc} AND "deletedAt" IS NULL LIMIT 1
      `;
      if (hit[0]) throw new Error("This RC/CAC number is already registered");
    } catch (e) {
      if (e instanceof Error && e.message.includes("already registered")) throw e;
    }
  }
  if (companyTin) {
    try {
      const hit = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE "companyTin" = ${companyTin} AND "deletedAt" IS NULL LIMIT 1
      `;
      if (hit[0]) throw new Error("This TIN is already registered");
    } catch (e) {
      if (e instanceof Error && e.message.includes("already registered")) throw e;
    }
  }

  const companyProfileJson =
    clientType === "COMPANY"
      ? JSON.stringify({
          rcNumber: companyRc,
          tin: companyTin,
          address: extra?.address || null,
          contactPerson: extra?.contactPerson || null,
          directors: extra?.directors || [],
        })
      : null;

  const hashed = await hashPassword(password);

  // Create with core fields; extra columns via raw if Prisma client lags
  const user = await prisma.user.create({
    data: {
      email: normalized,
      password: hashed,
      name: name.trim(),
      phone: phone || null,
      clientType,
      role: "CLIENT",
      status: "PENDING_APPROVAL",
      verificationStatus: "UNDER_REVIEW",
      agreedTermsAt: agreedTerms !== false ? new Date() : null,
      nin: nin || null,
      bvn: bvn || null,
    } as any,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      clientType: true,
    },
  });

  // Extra company / address columns
  try {
    await prisma.$executeRaw`
      UPDATE "User" SET
        address = ${extra?.address || null},
        "companyRc" = ${companyRc},
        "companyTin" = ${companyTin},
        "companyProfileJson" = ${companyProfileJson}
      WHERE id = ${user.id}
    `;
  } catch {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          address: extra?.address || null,
          companyRc,
          companyTin,
          companyProfileJson,
        } as any,
      });
    } catch {
      /* */
    }
  }

  // Registration documents
  if (Array.isArray(extra?.documents)) {
    for (const doc of extra!.documents!) {
      if (!doc?.type || !doc?.fileUrl) continue;
      try {
        await prisma.userDocument.create({
          data: {
            userId: user.id,
            type: doc.type,
            label: doc.label || doc.type,
            fileUrl: doc.fileUrl,
            fileName: doc.fileName || null,
            status: "UNDER_REVIEW",
          },
        });
      } catch {
        /* */
      }
    }
  }

  return user;
}

export async function ensureAdminFromEnv() {
  const email = process.env.ADMIN_EMAIL || process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return false;
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) return true;
  const hashed = await hashPassword(password);
  await prisma.user.create({
    data: {
      email: normalized,
      password: hashed,
      name: "Hama Admin",
      role: "ADMIN",
      status: "APPROVED",
      verificationStatus: "VERIFIED",
      clientType: "INDIVIDUAL",
    },
  });
  return true;
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}
