import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import { getCompanySealBytes, COMPANY_SEAL_RC } from "@/lib/company-seal";
import { getBlobToken } from "@/lib/media";

/** Load image bytes for PDF embedding (public URL, private blob, media proxy, or data URL) */
export async function fetchImageBytes(
  url: string
): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();

  // data:image/png;base64,....
  if (trimmed.startsWith("data:")) {
    try {
      const m = trimmed.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);
      if (!m) return null;
      const mime = m[1].toLowerCase();
      const b64 = m[3];
      const bytes = new Uint8Array(Buffer.from(b64, "base64"));
      const type: "png" | "jpg" = mime.includes("png") ? "png" : "jpg";
      return { bytes, type };
    } catch {
      return null;
    }
  }

  let target = trimmed;
  let useBlobAuth = false;

  // /api/media?u=<encoded private blob url>
  if (target.startsWith("/api/media") || target.includes("/api/media?")) {
    try {
      const q = target.includes("?") ? target.slice(target.indexOf("?") + 1) : "";
      const params = new URLSearchParams(q);
      const u = params.get("u");
      if (u) {
        target = decodeURIComponent(u);
        useBlobAuth = true;
      }
    } catch {
      /* keep target */
    }
  }

  // Relative path → absolute
  if (target.startsWith("/") && !target.startsWith("//")) {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || "https://buildforge-construction.vercel.app";
    target = `${base}${target}`;
  }

  // Private Vercel Blob needs Authorization
  try {
    const host = new URL(target).hostname;
    if (host.includes("blob.vercel-storage.com") || host.includes("vercel-storage.com")) {
      useBlobAuth = true;
    }
  } catch {
    /* */
  }

  try {
    const headers: Record<string, string> = {};
    if (useBlobAuth) {
      const token = getBlobToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(target, { headers, cache: "no-store" });
    if (!res.ok) {
      console.error("fetchImageBytes status", res.status, target.slice(0, 80));
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 20) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    // Sniff PNG magic bytes
    const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
    if (isPng || ct.includes("png") || target.toLowerCase().includes(".png")) {
      return { bytes: buf, type: "png" };
    }
    if (isJpg || ct.includes("jpeg") || ct.includes("jpg") || target.toLowerCase().includes(".jpg")) {
      return { bytes: buf, type: "jpg" };
    }
    // Default try PNG then caller may fail
    return { bytes: buf, type: isPng ? "png" : "jpg" };
  } catch (e) {
    console.error("fetchImageBytes", e);
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
  /** Raw base64 PNG from client (preferred when available) */
  signatureDataUrl?: string | null;
  allowUnsigned?: boolean;
};

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
  page.drawCircle({ x: cx, y: cy, size: r, borderColor: rgb(0.08, 0.1, 0.14), borderWidth: 2.2 });
  page.drawCircle({ x: cx, y: cy, size: r - 6, borderColor: rgb(0.15, 0.18, 0.22), borderWidth: 1 });
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
  const sigSource = opts.signatureDataUrl || opts.signatureUrl;
  if (sigSource) {
    const img = await fetchImageBytes(sigSource);
    if (img) {
      try {
        let embedded;
        try {
          embedded =
            img.type === "png" ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes);
        } catch {
          // Try the other format if sniff was wrong
          embedded =
            img.type === "png" ? await pdf.embedJpg(img.bytes) : await pdf.embedPng(img.bytes);
        }
        const maxW = 220;
        const maxH = 80;
        const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
        const w = Math.max(40, embedded.width * scale);
        const h = Math.max(20, embedded.height * scale);
        y -= h + 8;
        if (y < 110) y = 110;
        // White background behind signature for visibility
        page.drawRectangle({
          x: margin - 2,
          y: y - 2,
          width: w + 4,
          height: h + 4,
          color: rgb(1, 1, 1),
          borderColor: rgb(0.85, 0.87, 0.9),
          borderWidth: 0.5,
        });
        page.drawImage(embedded, { x: margin, y, width: w, height: h });
        y -= 14;
        hasSignature = true;
        draw(
          `Signed electronically · ${new Date().toLocaleDateString()}`,
          8,
          false,
          rgb(0.35, 0.4, 0.45)
        );
      } catch (err) {
        console.error("embed signature", err);
        draw(
          "(Signature on file but could not be embedded — re-save as PNG and download again)",
          9,
          false,
          rgb(0.7, 0.2, 0.2)
        );
      }
    } else {
      draw(
        "(Signature saved but image could not be loaded — re-save signature and download again)",
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
