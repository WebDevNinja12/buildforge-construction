import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function healSignatureColumn() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureUrl" TEXT`
    );
  } catch {
    /* */
  }
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureDataUrl" TEXT`
    );
  } catch {
    /* optional column for offline-safe PDF */
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await healSignatureColumn();

    let signatureUrl: string | null = null;
    let signatureDataUrl: string | null = null;
    try {
      const rows = await prisma.$queryRaw<
        { signatureUrl: string | null; signatureDataUrl?: string | null }[]
      >`SELECT "signatureUrl" FROM "User" WHERE id = ${session.id} LIMIT 1`;
      signatureUrl = rows[0]?.signatureUrl || null;
    } catch {
      /* */
    }
    try {
      const rows = await prisma.$queryRaw<{ signatureDataUrl: string | null }[]>`
        SELECT "signatureDataUrl" FROM "User" WHERE id = ${session.id} LIMIT 1
      `;
      signatureDataUrl = rows[0]?.signatureDataUrl || null;
    } catch {
      /* column may not exist */
    }

    if (!signatureUrl) {
      try {
        const doc = await prisma.userDocument.findFirst({
          where: { userId: session.id, type: "SIGNATURE" },
          orderBy: { createdAt: "desc" },
        });
        signatureUrl = doc?.fileUrl || null;
      } catch {
        /* */
      }
    }

    return NextResponse.json({ signatureUrl, signatureDataUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ signatureUrl: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await healSignatureColumn();

    const body = await req.json();
    const signatureUrl = String(body.signatureUrl || "").trim();
    const signatureDataUrl =
      typeof body.signatureDataUrl === "string" && body.signatureDataUrl.startsWith("data:image")
        ? body.signatureDataUrl.slice(0, 400_000) // keep under ~300KB text
        : null;

    if (!signatureUrl && !signatureDataUrl) {
      return NextResponse.json({ error: "signatureUrl required" }, { status: 400 });
    }

    if (signatureUrl) {
      try {
        await prisma.$executeRaw`
          UPDATE "User" SET "signatureUrl" = ${signatureUrl} WHERE id = ${session.id}
        `;
      } catch {
        try {
          await prisma.user.update({
            where: { id: session.id },
            data: { signatureUrl } as any,
          });
        } catch (err) {
          console.warn("signatureUrl column missing, using UserDocument", err);
          const existing = await prisma.userDocument.findFirst({
            where: { userId: session.id, type: "SIGNATURE" },
          });
          if (existing) {
            await prisma.userDocument.update({
              where: { id: existing.id },
              data: { fileUrl: signatureUrl, status: "APPROVED", label: "Signature" },
            });
          } else {
            await prisma.userDocument.create({
              data: {
                userId: session.id,
                type: "SIGNATURE",
                label: "Signature",
                fileUrl: signatureUrl,
                status: "APPROVED",
              },
            });
          }
        }
      }
    }

    if (signatureDataUrl) {
      try {
        await prisma.$executeRaw`
          UPDATE "User" SET "signatureDataUrl" = ${signatureDataUrl} WHERE id = ${session.id}
        `;
      } catch {
        /* column optional */
      }
    }

    return NextResponse.json({
      ok: true,
      signatureUrl: signatureUrl || null,
      message: "Signature saved. Download the agreement to get a PDF with your signature.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not save signature", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
