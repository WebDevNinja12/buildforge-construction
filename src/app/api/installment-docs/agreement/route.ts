import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveSignatureUrl(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { signatureUrl: true } as any,
    });
    if ((user as any)?.signatureUrl) return (user as any).signatureUrl as string;
  } catch {
    /* column missing */
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

async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  try {
    let fetchUrl = url;
    // Internal media proxy
    if (url.startsWith("/api/media")) {
      const base = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || "https://buildforge-construction.vercel.app";
      fetchUrl = `${base}${url}`;
    }
    const res = await fetch(fetchUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("png") || url.toLowerCase().includes(".png")) {
      return { bytes: buf, type: "png" };
    }
    return { bytes: buf, type: "jpg" };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const sp = req.nextUrl.searchParams;
    const reservationId = sp.get("reservationId");

    let clientName = "_______________________________";
    let clientEmail = "";
    let serviceTitle = "_______________________________";
    let totalPrice = "_______________________________";
    let frequency = "__________";
    let deadline = "__________";
    let signatureUrl: string | null = null;

    if (session) {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { name: true, email: true },
      });
      if (user) {
        clientName = user.name;
        clientEmail = user.email;
      }
      signatureUrl = await resolveSignatureUrl(session.id);

      if (reservationId) {
        const plan = await prisma.reservation.findFirst({
          where:
            session.role === "ADMIN"
              ? { id: reservationId }
              : { id: reservationId, userId: session.id },
          include: { asset: true },
        });
        if (plan) {
          serviceTitle = plan.asset?.title || serviceTitle;
          totalPrice = plan.installmentTotal
            ? String(plan.installmentTotal)
            : plan.asset?.price
              ? String(plan.asset.price)
              : totalPrice;
          frequency = plan.installmentFrequency || frequency;
          deadline = plan.planDeadlineAt
            ? new Date(plan.planDeadlineAt).toLocaleDateString()
            : deadline;
        }
      }
    }

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;

    const draw = (text: string, size = 11, bold = false, color = rgb(0.1, 0.12, 0.16)) => {
      page.drawText(text, {
        x: margin,
        y,
        size,
        font: bold ? fontBold : font,
        color,
        maxWidth: width - margin * 2,
      });
      y -= size + 8;
    };

    draw("Hama Construction", 14, true, rgb(0.05, 0.35, 0.55));
    draw("Building innovation through quality and trust", 9, false, rgb(0.4, 0.45, 0.5));
    y -= 6;
    draw("Installment Payment Agreement", 16, true);
    y -= 4;
    draw(`Generated: ${new Date().toLocaleString()}`, 9, false, rgb(0.45, 0.5, 0.55));
    y -= 8;

    draw("1. Parties", 12, true);
    draw(`Client name: ${clientName}`);
    draw(`Email: ${clientEmail || "_______________________________"}`);
    draw("Provider: Hama Construction");
    y -= 6;

    draw("2. Property / service", 12, true);
    draw(`Description: ${serviceTitle}`);
    draw(`Total price: ${totalPrice}`);
    y -= 6;

    draw("3. Payment terms", 12, true);
    draw(`Frequency: ${frequency}    Plan deadline: ${deadline}`);
    draw(
      "The client agrees to pay each installment on or before the due date. Late payments may incur"
    );
    draw("grace rules and cancellation deductions published on the platform.");
    y -= 6;

    draw("4. Documents", 12, true);
    draw("The client confirms that all supporting documents submitted are true and accurate.");
    y -= 6;

    draw("5. Cancellation", 12, true);
    draw("Cancellation may attract a deduction percentage set by category and stage of the plan.");
    y -= 20;

    draw("Client signature", 11, true);

    // Embed signature image if available
    if (signatureUrl) {
      const img = await fetchImageBytes(signatureUrl);
      if (img) {
        try {
          const embedded =
            img.type === "png"
              ? await pdf.embedPng(img.bytes)
              : await pdf.embedJpg(img.bytes);
          const maxW = 200;
          const maxH = 70;
          const scale = Math.min(maxW / embedded.width, maxH / embedded.height);
          const w = embedded.width * scale;
          const h = embedded.height * scale;
          page.drawImage(embedded, {
            x: margin,
            y: y - h,
            width: w,
            height: h,
          });
          y -= h + 8;
          draw(`Signed electronically by ${clientName}`, 9, false, rgb(0.2, 0.45, 0.3));
          draw(new Date().toLocaleDateString(), 9, false, rgb(0.45, 0.5, 0.55));
        } catch (err) {
          console.error("embed signature", err);
          draw("(Signature on file — could not embed image; sign manually if needed)", 9);
        }
      } else {
        draw("(Signature saved but image could not be loaded — re-save signature and download again)", 9);
        page.drawLine({
          start: { x: margin, y: y - 2 },
          end: { x: margin + 220, y: y - 2 },
          thickness: 0.8,
          color: rgb(0.6, 0.65, 0.7),
        });
        y -= 24;
      }
    } else {
      draw("(No signature on file — draw/upload signature in the app, then download again)", 9);
      page.drawLine({
        start: { x: margin, y: y - 2 },
        end: { x: margin + 220, y: y - 2 },
        thickness: 0.8,
        color: rgb(0.6, 0.65, 0.7),
      });
      y -= 24;
    }

    y -= 30;
    draw("Hama Construction", 11, true);
    page.drawLine({
      start: { x: margin, y: y - 2 },
      end: { x: margin + 220, y: y - 2 },
      thickness: 0.8,
      color: rgb(0.6, 0.65, 0.7),
    });
    y -= 20;
    draw("Authorized signatory", 9, false, rgb(0.45, 0.5, 0.55));

    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hama-installment-agreement.pdf"`,
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
