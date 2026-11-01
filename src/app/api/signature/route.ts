import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, name: true, signatureUrl: true },
    });

    return NextResponse.json({
      signatureUrl: (user as any)?.signatureUrl || null,
      name: user?.name,
    });
  } catch (e) {
    // Column may not exist until db push
    console.error(e);
    return NextResponse.json({ signatureUrl: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const signatureUrl = String(body.signatureUrl || "").trim();
    if (!signatureUrl) {
      return NextResponse.json({ error: "signatureUrl required" }, { status: 400 });
    }

    try {
      await prisma.user.update({
        where: { id: session.id },
        data: { signatureUrl } as any,
      });
    } catch (err) {
      // Fallback: store as UserDocument type=SIGNATURE
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

    return NextResponse.json({
      ok: true,
      signatureUrl,
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
