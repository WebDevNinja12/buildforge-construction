import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

function yearSeq() {
  return `HC-${new Date().getFullYear()}`;
}

export async function nextContractNumber() {
  const prefix = yearSeq();
  const count = await prisma.contract.count({
    where: { contractNumber: { startsWith: prefix } },
  });
  return `${prefix}-${String(count + 1).padStart(6, "0")}`;
}

export function randomVerifyToken() {
  return randomBytes(24).toString("hex");
}

export async function buildAgreementPdf(opts: {
  contractNumber: string;
  verifyToken: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  nin?: string | null;
  serviceTitle: string;
  paymentMethod: string;
  totalAmount: number;
  scheduleText?: string;
  rulesText?: string;
  cancelText?: string;
  signatureUrl?: string | null;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  let y = height - 50;

  const draw = (text: string, size = 11, isBold = false) => {
    page.drawText(text.slice(0, 90), {
      x: 50,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.1, 0.12, 0.18),
    });
    y -= size + 8;
  };

  draw("HAMA CONSTRUCTION", 18, true);
  draw("Building innovation through quality and trust", 10);
  y -= 6;
  draw("AGREEMENT LETTER", 14, true);
  draw(`Contract No: ${opts.contractNumber}`, 11, true);
  draw(`Issued: ${new Date().toLocaleDateString()}`);
  y -= 8;
  draw("Client", 12, true);
  draw(`Name: ${opts.clientName}`);
  draw(`Email: ${opts.clientEmail}`);
  if (opts.clientPhone) draw(`Phone: ${opts.clientPhone}`);
  if (opts.nin) draw(`NIN: ${opts.nin}`);
  y -= 6;
  draw("Service / Asset", 12, true);
  draw(opts.serviceTitle);
  draw(`Payment method: ${opts.paymentMethod}`);
  draw(`Total price: $${Number(opts.totalAmount || 0).toFixed(2)}`);
  if (opts.scheduleText) {
    y -= 4;
    draw("Schedule / deadline", 12, true);
    for (const line of opts.scheduleText.split("\n").slice(0, 6)) draw(line, 10);
  }
  if (opts.rulesText) {
    y -= 4;
    draw("Installment rules", 12, true);
    for (const line of opts.rulesText.split("\n").slice(0, 5)) draw(line.slice(0, 90), 9);
  }
  if (opts.cancelText) {
    y -= 4;
    draw("Cancellation terms", 12, true);
    for (const line of opts.cancelText.split("\n").slice(0, 4)) draw(line.slice(0, 90), 9);
  }

  y -= 10;
  draw("Company signature / stamp: _________________________", 10);
  draw("Client signature space: _____________________________", 10);

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://buildforge-construction.vercel.app");
  const verifyUrl = `${base}/verify/${opts.verifyToken}`;
  draw(`Verify: ${verifyUrl}`, 8);

  try {
    const qrRes = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verifyUrl)}`
    );
    if (qrRes.ok) {
      const bytes = await qrRes.arrayBuffer();
      const img = await doc.embedPng(bytes).catch(async () => doc.embedJpg(bytes));
      page.drawImage(img, { x: width - 170, y: 40, width: 100, height: 100 });
    }
  } catch {
    /* QR optional */
  }

  if (opts.signatureUrl) {
    try {
      const sigRes = await fetch(opts.signatureUrl);
      if (sigRes.ok) {
        const bytes = await sigRes.arrayBuffer();
        const img = await doc.embedPng(bytes).catch(async () => doc.embedJpg(bytes));
        page.drawImage(img, { x: 50, y: 60, width: 120, height: 40 });
      }
    } catch {
      /* */
    }
  }

  const pdfBytes = await doc.save();
  const blob = await put(`contracts/${opts.contractNumber}.pdf`, Buffer.from(pdfBytes), {
    access: "public",
    contentType: "application/pdf",
    token: process.env.BLOB_READ_WRITE_TOKEN || process.env.construction_READ_WRITE_TOKEN,
  });
  return blob.url;
}
