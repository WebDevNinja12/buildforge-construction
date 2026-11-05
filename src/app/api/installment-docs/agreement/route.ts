import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildInstallmentAgreementPdf } from "@/lib/agreement-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveSignatureUrl(userId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<{ signatureUrl: string | null }[]>`
      SELECT "signatureUrl" FROM "User" WHERE id = ${userId} LIMIT 1
    `;
    if (rows[0]?.signatureUrl) return rows[0].signatureUrl;
  } catch {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { signatureUrl: true } as any,
      });
      if ((user as any)?.signatureUrl) return (user as any).signatureUrl as string;
    } catch {
      /* */
    }
  }
  try {
    const doc = await prisma.userDocument.findFirst({
      where: { userId, type: "SIGNATURE" },
      orderBy: { createdAt: "desc" },
    });
    return doc?.fileUrl || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const sp = req.nextUrl.searchParams;
    const reservationId = sp.get("reservationId");
    const requireSignature = sp.get("requireSignature") === "1";
    // Optional: client can pass data URL if blob fetch fails (base64, truncated length ok for small sigs)
    const signatureDataParam = sp.get("sigData");

    let clientName = "_______________________________";
    let clientEmail = "";
    let clientPhone: string | null = null;
    let serviceTitle = "_______________________________";
    let totalPrice = "_______________________________";
    let frequency = "__________";
    let deadline = "__________";
    let signatureUrl: string | null = null;

    if (session) {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { name: true, email: true, phone: true },
      });
      if (user) {
        clientName = user.name;
        clientEmail = user.email;
        clientPhone = user.phone;
      }
      signatureUrl = await resolveSignatureUrl(session.id);

      if (reservationId) {
        try {
          const r = await prisma.reservation.findFirst({
            where: { id: reservationId, userId: session.id },
            include: { asset: true },
          });
          if (r) {
            serviceTitle = (r as any).asset?.title || serviceTitle;
            const total = Number((r as any).installmentTotal || (r as any).asset?.price || 0);
            totalPrice = total ? `$${total.toFixed(2)}` : totalPrice;
            frequency = (r as any).installmentFrequency || frequency;
            if ((r as any).planDeadlineAt) {
              deadline = new Date((r as any).planDeadlineAt).toLocaleDateString();
            } else if ((r as any).expiresAt) {
              deadline = new Date((r as any).expiresAt).toLocaleDateString();
            }
          }
        } catch {
          /* */
        }
      }
    }

    let signatureDataUrl: string | null = null;
    if (signatureDataParam && signatureDataParam.startsWith("data:image")) {
      signatureDataUrl = signatureDataParam;
    }

    if (requireSignature && !signatureUrl && !signatureDataUrl) {
      return NextResponse.json(
        {
          error:
            "Signature required. Draw or upload your signature first, then download the agreement.",
          code: "SIGNATURE_REQUIRED",
        },
        { status: 400 }
      );
    }

    const { bytes, hasSignature } = await buildInstallmentAgreementPdf({
      clientName,
      clientEmail,
      clientPhone,
      serviceTitle,
      totalPrice,
      frequency,
      deadline,
      paymentMethod: "INSTALLMENT",
      signatureUrl,
      signatureDataUrl,
      allowUnsigned: !requireSignature,
    });

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hama-installment-agreement.pdf"`,
        "X-Has-Signature": hasSignature ? "1" : "0",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("agreement PDF", e);
    return NextResponse.json(
      {
        error: "Could not generate agreement PDF",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

/** POST: generate PDF with optional body.signatureDataUrl for reliable embedding */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Please login" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const reservationId = body.reservationId ? String(body.reservationId) : null;
    const signatureDataUrl =
      typeof body.signatureDataUrl === "string" && body.signatureDataUrl.startsWith("data:image")
        ? body.signatureDataUrl
        : null;

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, email: true, phone: true },
    });

    let serviceTitle = "Installment service";
    let totalPrice = "—";
    let frequency = "—";
    let deadline = "—";

    if (reservationId) {
      try {
        const r = await prisma.reservation.findFirst({
          where: { id: reservationId, userId: session.id },
          include: { asset: true },
        });
        if (r) {
          serviceTitle = (r as any).asset?.title || serviceTitle;
          const total = Number((r as any).installmentTotal || (r as any).asset?.price || 0);
          totalPrice = total ? `$${total.toFixed(2)}` : totalPrice;
          frequency = (r as any).installmentFrequency || frequency;
        }
      } catch {
        /* */
      }
    }

    const signatureUrl = await resolveSignatureUrl(session.id);

    if (!signatureUrl && !signatureDataUrl) {
      return NextResponse.json(
        { error: "Signature required before downloading the agreement." },
        { status: 400 }
      );
    }

    const { bytes, hasSignature } = await buildInstallmentAgreementPdf({
      clientName: user?.name || "Client",
      clientEmail: user?.email || "",
      clientPhone: user?.phone,
      serviceTitle,
      totalPrice,
      frequency,
      deadline,
      paymentMethod: "INSTALLMENT",
      signatureUrl,
      signatureDataUrl,
    });

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hama-installment-agreement.pdf"`,
        "X-Has-Signature": hasSignature ? "1" : "0",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("agreement PDF POST", e);
    return NextResponse.json(
      { error: "Could not generate agreement PDF", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
