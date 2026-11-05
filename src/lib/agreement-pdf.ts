import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import { getCompanySealBytes, COMPANY_SEAL_RC } from "@/lib/company-seal";

export async function fetchImageBytes(
  url: string
): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  try {
    let fetchUrl = url;
    if (url.startsWith("/api/media") || (url.startsWith("/") && !url.startsWith("//"))) {
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

export type AgreementPdfOpts = {
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  serviceTitle: string;
  totalPrice: string;
  frequency?: string;
  deadline?: string;
  paymentMethod?: string;
  scheduleText?: string;
  rulesText?: string;
  cancelText?: string;
  contractNumber?: string;
  signatureUrl?: string | null;
  allowUnsigned?: boolean;
};

/** Draw official-looking seal when PNG is not available */
function drawVectorSeal(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  x: number,
  y: number,
  size = 70
) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size / 2 - 2;
  // Outer ring
  page.drawCircle({ x: cx, y: cy, size: r, borderColor: rgb(0.08, 0.1, 0.14), borderWidth: 2.2 });
  page.drawCircle({ x: cx, y: cy, size: r - 6, borderColor: rgb(0.15, 0.18, 0.22), borderWidth: 1 });
  // Accent arc suggestion via small marks
  page.drawText("HAMA", {
    x: cx - 16,
    y: cy + 6,
    size: 9,
    font: bold,
    color: rgb(0.1, 0.12, 0.16),
  });
  page.drawText("CONSTRUCTION", {
    x: cx - 28,
    y: cy - 6,
    size: 6,
    font: bold,
    color: rgb(0.2, 0.22, 0.26),
  });
  page.drawText(COMPANY_SEAL_RC, {
    x: cx - 22,
    y: cy - 18,
    size: 6,
    font,
    color: rgb(0.15, 0.15, 0.18),
  });
}

async function stampSeal(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  x: number,
  y: number,
  size: number
) {
  const bytes = getCompanySealBytes();
  if (bytes) {
    try {
      const seal = await pdf.embedPng(bytes);
      const h = (seal.height / seal.width) * size;
      page.drawImage(seal, { x, y: y - (h - size) / 2, width: size, height: h });
      return;
    } catch {
      /* fall through */
    }
  }
  drawVectorSeal(page, font, bold, x, y, size);
}

/** Build installment agreement PDF with company seal + client signature */
export async function buildInstallmentAgreementPdf(opts: AgreementPdfOpts): Promise<{
  bytes: Uint8Array;
  hasSignature: boolean;
}> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // Top-right company seal
  await stampSeal(pdf, page, font, fontBold, width - margin - 78, height - margin - 78, 72);

  const draw = (text: string, size = 11, bold = false, color = rgb(0.1, 0.12, 0.16)) => {
    page.drawText(String(text).slice(0, 95), {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
      color,
      maxWidth: width - margin * 2 - 90,
    });
    y -= size + 8;
  };

  draw("Hama Construction", 16, true, rgb(0.12, 0.16, 0.22));
  draw("Building innovation through quality and trust", 9, false, rgb(0.4, 0.45, 0.5));
  draw(`Company registration: ${COMPANY_SEAL_RC}`, 8, false, rgb(0.45, 0.48, 0.52));
  y -= 4;
  draw("Installment Payment Agreement", 15, true, rgb(0.9, 0.4, 0.05));
  if (opts.contractNumber) draw(`Contract No: ${opts.contractNumber}`, 10, true);
  draw(`Generated: ${new Date().toLocaleString()}`, 9, false, rgb(0.45, 0.5, 0.55));
  y -= 6;

  draw("1. Parties", 12, true);
  draw(`Client name: ${opts.clientName}`);
  draw(`Email: ${opts.clientEmail || "_______________________________"}`);
  if (opts.clientPhone) draw(`Phone: ${opts.clientPhone}`);
  draw("Provider: Hama Construction");
  y -= 4;

  draw("2. Property / service", 12, true);
  draw(`Description: ${opts.serviceTitle}`);
  draw(`Total price: ${opts.totalPrice}`);
  if (opts.paymentMethod) draw(`Payment method: ${opts.paymentMethod}`);
  y -= 4;

  draw("3. Payment terms", 12, true);
  draw(
    `Frequency: ${opts.frequency || "__________"}    Plan deadline: ${opts.deadline || "__________"}`
  );
  draw("The client agrees to pay each installment on or before the due date.");
  draw("Late payments may incur grace rules and cancellation deductions.");
  if (opts.scheduleText) {
    for (const line of opts.scheduleText.split("\n").slice(0, 5)) draw(line, 9);
  }
  y -= 4;

  draw("4. Documents", 12, true);
  draw("The client confirms that all supporting documents submitted are true and accurate.");
  y -= 4;

  draw("5. Cancellation", 12, true);
  draw("Cancellation may attract a deduction percentage set by category and stage.");
  if (opts.cancelText) {
    for (const line of opts.cancelText.split("\n").slice(0, 3)) draw(line, 9);
  }
  if (opts.rulesText) {
    y -= 4;
    draw("6. Installment rules", 12, true);
    for (const line of opts.rulesText.split("\n").slice(0, 5)) draw(line.slice(0, 90), 9);
  }

  y -= 16;
  draw("Client signature", 11, true);

  let hasSignature = false;
  if (opts.signatureUrl) {
    const img = await fetchImageBytes(opts.signatureUrl);
    if (img) {
      try {
        const embedded =
          img.type === "png" ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes);
        const maxW = 200;
        const maxH = 70;
        const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
        const w = embedded.width * scale;
        const h = embedded.height * scale;
        y -= h + 4;
        if (y < 100) y = 100;
        page.drawImage(embedded, { x: margin, y, width: w, height: h });
        y -= 12;
        hasSignature = true;
        draw(
          `Signed electronically · ${new Date().toLocaleDateString()}`,
          8,
          false,
          rgb(0.35, 0.4, 0.45)
        );
      } catch {
        draw(
          "(Signature on file but image could not be embedded — re-save signature)",
          9,
          false,
          rgb(0.7, 0.2, 0.2)
        );
      }
    } else {
      draw(
        "(Signature URL could not be loaded — re-save signature and download again)",
        9,
        false,
        rgb(0.7, 0.2, 0.2)
      );
    }
  } else {
    page.drawLine({
      start: { x: margin, y: y - 5 },
      end: { x: margin + 220, y: y - 5 },
      thickness: 0.8,
      color: rgb(0.6, 0.65, 0.7),
    });
    y -= 18;
    draw(
      "(No signature on file — draw or upload your signature in the app first)",
      9,
      false,
      rgb(0.7, 0.2, 0.2)
    );
  }

  // Seal near signature block
  await stampSeal(pdf, page, font, fontBold, width - margin - 64, Math.max(36, y - 20), 56);
  page.drawText("Company seal", {
    x: width - margin - 64,
    y: Math.max(24, y - 36),
    size: 7,
    font,
    color: rgb(0.45, 0.48, 0.52),
  });

  page.drawText(
    "This document is issued by Hama Construction. Unsigned agreements will be rejected.",
    {
      x: margin,
      y: 28,
      size: 8,
      font,
      color: rgb(0.4, 0.42, 0.45),
    }
  );

  const bytes = await pdf.save();
  return { bytes, hasSignature };
}
