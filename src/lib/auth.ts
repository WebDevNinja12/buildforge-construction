import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { healSchema } from "@/lib/schema-heal";
import type { AccountType, ContactPerson, DirectorInput } from "@/lib/registration";

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

export const DEFAULT_ADMIN_EMAIL = "hamaconstruction01@gmail.com";
export const DEFAULT_ADMIN_PASSWORD = "HamaAdmin2026!";

const LEGACY_ADMIN_EMAILS = [
  "admin@hamaconstruction.com",
  "admin@buildforge.com",
  "admin@hamaconstroction.com",
];

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

export async function ensureAdminFromEnv(): Promise<boolean> {
  const email = (process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== "ADMIN") {
        await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN", status: "APPROVED" } });
      }
      return true;
    }
    for (const leg of LEGACY_ADMIN_EMAILS) {
      const u = await prisma.user.findUnique({ where: { email: leg } });
      if (u) {
        await prisma.user.update({
          where: { id: u.id },
          data: { email, role: "ADMIN", status: "APPROVED", verificationStatus: "VERIFIED" },
        });
        return true;
      }
    }
    const hashed = await hashPassword(password);
    await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: "Hama Admin",
        role: "ADMIN",
        status: "APPROVED",
        verificationStatus: "VERIFIED",
        clientType: "INDIVIDUAL",
      },
    });
    return true;
  } catch (e) {
    console.error("ensureAdminFromEnv", e);
    return false;
  }
}

export type RegisterExtra = {
  clientType?: AccountType;
  address?: string;
  nin?: string;
  bvn?: string;
  companyRc?: string;
  companyTin?: string;
  contactPerson?: ContactPerson;
  directors?: DirectorInput[];
  documents?: Array<{ type: string; label?: string; fileUrl: string; fileName?: string }>;
};

async function healRegistrationColumns() {
  await healSchema().catch(() => null);
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone?: string,
  agreedTerms?: boolean,
  extra?: RegisterExtra
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

  if (nin) {
    const hit = await prisma.user.findFirst({ where: { nin, deletedAt: null }, select: { id: true } });
    if (hit) throw new Error("This NIN is already registered to another account");
  }
  if (bvn) {
    const hit = await prisma.user.findFirst({ where: { bvn, deletedAt: null }, select: { id: true } });
    if (hit) throw new Error("This BVN is already registered to another account");
  }
  if (companyRc) {
    try {
      const hit = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE "companyRc" = ${companyRc} AND "deletedAt" IS NULL LIMIT 1`;
      if (hit[0]) throw new Error("This RC/CAC number is already registered");
    } catch (e) {
      if (e instanceof Error && e.message.includes("already registered")) throw e;
    }
  }
  if (companyTin) {
    try {
      const hit = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE "companyTin" = ${companyTin} AND "deletedAt" IS NULL LIMIT 1`;
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
      agreedTermsAt: agreedTerms === false ? null : new Date(),
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
    /* */
  }

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

export class AccountBlockedError extends Error {
  code: "ACCOUNT_SUSPENDED" | "ACCOUNT_REJECTED";
  status: string;
  verificationNote?: string | null;
  constructor(
    code: "ACCOUNT_SUSPENDED" | "ACCOUNT_REJECTED",
    message: string,
    status: string,
    verificationNote?: string | null
  ) {
    super(message);
    this.name = "AccountBlockedError";
    this.code = code;
    this.status = status;
    this.verificationNote = verificationNote;
  }
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
      verificationNote: true,
    },
  });
  if (!user) throw new Error("Invalid email or password");

  const valid = await verifyPassword(password, user.password);
  if (!valid) throw new Error("Invalid email or password");
  if (user.deletedAt) throw new Error("Invalid email or password");

  if (user.status === "SUSPENDED") {
    throw new AccountBlockedError(
      "ACCOUNT_SUSPENDED",
      "Your account is suspended because platform rules were violated.",
      "SUSPENDED",
      (user as { verificationNote?: string | null }).verificationNote
    );
  }
  if (user.status === "REJECTED") {
    throw new AccountBlockedError(
      "ACCOUNT_REJECTED",
      "Your account was not approved. Contact support.",
      "REJECTED",
      (user as { verificationNote?: string | null }).verificationNote
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
