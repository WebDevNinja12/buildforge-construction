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
  y -= 6;
  draw("Service / Asset", 12, true);
  draw(opts.serviceTitle);
  draw(`Payment method: ${opts.paymentMethod}`);
  draw(`Total price: NGN ${Number(opts.totalAmount || 0).toLocaleString("en-NG")}`);
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

/** Create (or return existing) signed agreement for a client / reservation. */
export async function issueContractForUser(opts: {
  userId: string;
  reservationId?: string | null;
  forceNew?: boolean;
}) {
  const user = await prisma.user.findUnique({ where: { id: opts.userId } });
  if (!user) throw new Error("User not found");

  if (opts.reservationId && !opts.forceNew) {
    const existing = await prisma.contract
      .findFirst({
        where: { userId: opts.userId, reservationId: opts.reservationId },
        orderBy: { issuedAt: "desc" },
      })
      .catch(() => null);
    if (existing) return existing;
  }

  let serviceTitle = "Hama Construction service agreement";
  let paymentMethod = "As agreed";
  let totalAmount = 0;
  let scheduleText = "";
  let reservationId: string | null = opts.reservationId || null;

  if (reservationId) {
    const res = await prisma.reservation
      .findUnique({
        where: { id: reservationId },
        include: { asset: true },
      })
      .catch(() => null);
    if (res) {
      serviceTitle = (res as any).asset?.title || (res as any).asset?.name || serviceTitle;
      paymentMethod = (res as any).paymentType || paymentMethod;
      totalAmount =
        Number((res as any).installmentTotal) ||
        Number((res as any).total) ||
        Number((res as any).asset?.price) ||
        0;
      if ((res as any).scheduleJson) {
        try {
          const sch = JSON.parse((res as any).scheduleJson);
          if (Array.isArray(sch)) {
            scheduleText = sch
              .slice(0, 8)
              .map(
                (s: any, i: number) =>
                  `#${i + 1}: NGN ${Number(s.amount || 0).toLocaleString("en-NG")} due ${s.dueAt || s.due || ""}`
              )
              .join("\n");
          }
        } catch {
          /* */
        }
      }
    }
  } else {
    const latest = await prisma.reservation
      .findFirst({
        where: { userId: opts.userId },
        orderBy: { createdAt: "desc" },
        include: { asset: true },
      })
      .catch(() => null);
    if (latest) {
      reservationId = latest.id;
      serviceTitle = (latest as any).asset?.title || (latest as any).asset?.name || serviceTitle;
      paymentMethod = (latest as any).paymentType || paymentMethod;
      totalAmount =
        Number((latest as any).installmentTotal) ||
        Number((latest as any).total) ||
        Number((latest as any).asset?.price) ||
        0;
    }
  }

  const contractNumber = await nextContractNumber();
  const verifyToken = randomVerifyToken();

  let pdfUrl: string | null = null;
  try {
    pdfUrl = await buildAgreementPdf({
      contractNumber,
      verifyToken,
      clientName: user.name || user.email,
      clientEmail: user.email,
      clientPhone: user.phone,
      serviceTitle,
      paymentMethod,
      totalAmount,
      scheduleText: scheduleText || undefined,
      rulesText:
        "First installment 40% of total; subsequent installments 20% each until paid. Surcharge on installment plans is a fee, not interest. Cancellation: 10% deduction; refund within 7 days.",
      cancelText: "If cancelled, 10% is deducted. Refund processing period is 7 days.",
      signatureUrl: (user as any).signatureUrl || null,
    });
  } catch (e) {
    console.error("buildAgreementPdf", e);
  }

  const contract = await prisma.contract.create({
    data: {
      contractNumber,
      verifyToken,
      userId: user.id,
      reservationId: reservationId || undefined,
      status: "ACTIVE",
      pdfUrl: pdfUrl || undefined,
      clientName: user.name || user.email,
      serviceTitle,
      paymentMethod,
      totalAmount,
      issuedAt: new Date(),
    },
  });

  await prisma.notification
    .create({
      data: {
        userId: user.id,
        title: "Agreement ready",
        body: `Your contract ${contractNumber} is ready. Open My Contracts to download the PDF.`,
        type: "CONTRACT",
      },
    })
    .catch(() => null);

  return contract;
}
