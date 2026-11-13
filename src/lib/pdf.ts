/**
 * Report / statement PDFs with bordered tables (pdf-lib).
 * Layout guided by Hama Admin Overview Report sample.
 */
import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb, RGB } from "pdf-lib";

export const PAYMENT_METHOD_LABEL = "Bank Transfer";

/** Naira display */
export function money(n: number | null | undefined): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v).toLocaleString("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return (v < 0 ? "-" : "") + "NGN " + abs;
}

/** Legacy column helper */
export function col(a: string, b: string, c: string, d: string, e: string): string {
  const pad = (s: string, w: number, right = false) => {
    const t = String(s ?? "").slice(0, w);
    return right ? t.padStart(w) : t.padEnd(w);
  };
  return [pad(a, 12), pad(b, 28), pad(c, 12, true), pad(d, 12, true), pad(e, 14, true)].join(" ");
}

export type PdfTableColumn = {
  key: string;
  header: string;
  width: number;
  align?: "left" | "right" | "center";
};

export type PdfTable = {
  title?: string;
  sectionNumber?: number;
  columns: PdfTableColumn[];
  rows: Record<string, string | number | null | undefined>[];
};

const NAVY = rgb(0.07, 0.15, 0.28);
const ORANGE = rgb(0.95, 0.45, 0.1);
const HEADER_BG = rgb(0.12, 0.22, 0.4);
const ROW_ALT = rgb(0.96, 0.97, 0.98);
const BORDER = rgb(0.78, 0.82, 0.88);
const TEXT = rgb(0.12, 0.14, 0.18);
const MUTED = rgb(0.4, 0.45, 0.52);
const WHITE = rgb(1, 1, 1);
const GREEN = rgb(0.05, 0.55, 0.3);
const RED = rgb(0.75, 0.15, 0.15);
const AMBER = rgb(0.75, 0.45, 0.05);

function statusColor(s: string): RGB {
  const t = s.toLowerCase();
  if (t.includes("active") || t.includes("approved") || t.includes("completed") || t.includes("open"))
    return GREEN;
  if (t.includes("overdue") || t.includes("reject") || t.includes("cancel")) return RED;
  if (t.includes("pending")) return AMBER;
  return TEXT;
}

function cellText(raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "—";
  if (typeof raw === "number") return money(raw);
  return String(raw);
}

type DrawCtx = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  width: number;
  height: number;
  y: number;
  pageNum: number;
  marginX: number;
  footerLeft: string;
};

function ensureSpace(ctx: DrawCtx, need: number) {
  if (ctx.y - need < 50) {
    addFooter(ctx);
    ctx.page = ctx.doc.addPage([595, 842]);
    ctx.width = 595;
    ctx.height = 842;
    ctx.y = ctx.height - 40;
    ctx.pageNum += 1;
  }
}

function addFooter(ctx: DrawCtx) {
  const { page, font, width, pageNum, footerLeft } = ctx;
  page.drawText(footerLeft.slice(0, 70), {
    x: 40,
    y: 22,
    size: 7,
    font,
    color: MUTED,
  });
  page.drawText(`Page ${pageNum}`, {
    x: width - 70,
    y: 22,
    size: 7,
    font,
    color: MUTED,
  });
  page.drawRectangle({
    x: 0,
    y: 36,
    width,
    height: 2,
    color: ORANGE,
  });
}

function drawHeaderBand(ctx: DrawCtx, rightLabel: string) {
  const { page, bold, font, width, height } = ctx;
  page.drawRectangle({ x: 0, y: height - 48, width, height: 48, color: NAVY });
  page.drawText("Hama", {
    x: 40,
    y: height - 30,
    size: 14,
    font: bold,
    color: WHITE,
  });
  page.drawText(" Construction", {
    x: 78,
    y: height - 30,
    size: 14,
    font: bold,
    color: ORANGE,
  });
  page.drawText(rightLabel.slice(0, 48), {
    x: width - 220,
    y: height - 28,
    size: 8,
    font,
    color: rgb(0.75, 0.8, 0.88),
  });
  page.drawRectangle({ x: 0, y: height - 52, width, height: 4, color: ORANGE });
  ctx.y = height - 70;
}

function drawSectionTitle(ctx: DrawCtx, num: number | undefined, title: string) {
  ensureSpace(ctx, 28);
  const label = num != null ? `${num}. ${title}` : title;
  ctx.page.drawText(label, {
    x: ctx.marginX,
    y: ctx.y,
    size: 11,
    font: ctx.bold,
    color: NAVY,
  });
  ctx.y -= 16;
}

function drawTable(ctx: DrawCtx, table: PdfTable) {
  const { page, font, bold, marginX, width } = ctx;
  const usable = width - marginX * 2;
  const totalWeight = table.columns.reduce((s, c) => s + c.width, 0) || 1;
  const colWidths = table.columns.map((c) => (c.width / totalWeight) * usable);
  const rowH = 16;
  const headerH = 18;

  if (table.title) {
    drawSectionTitle(ctx, table.sectionNumber, table.title);
  }

  const drawRowBg = (y: number, h: number, fill: RGB) => {
    page.drawRectangle({
      x: marginX,
      y: y - h + 4,
      width: usable,
      height: h,
      color: fill,
      borderColor: BORDER,
      borderWidth: 0.4,
    });
  };

  ensureSpace(ctx, headerH + 4);
  drawRowBg(ctx.y, headerH, HEADER_BG);
  let x = marginX + 4;
  for (let i = 0; i < table.columns.length; i++) {
    const c = table.columns[i];
    const w = colWidths[i];
    page.drawText(c.header.slice(0, 24), {
      x,
      y: ctx.y - 8,
      size: 8,
      font: bold,
      color: WHITE,
    });
    x += w;
  }
  ctx.y -= headerH;

  if (!table.rows.length) {
    ensureSpace(ctx, rowH);
    drawRowBg(ctx.y, rowH, WHITE);
    page.drawText("(none)", {
      x: marginX + 4,
      y: ctx.y - 8,
      size: 8,
      font,
      color: MUTED,
    });
    ctx.y -= rowH + 8;
    return;
  }

  table.rows.forEach((row, idx) => {
    ensureSpace(ctx, rowH + 2);
    const bg = idx % 2 === 0 ? WHITE : ROW_ALT;
    drawRowBg(ctx.y, rowH, bg);
    let cx = marginX + 4;
    for (let i = 0; i < table.columns.length; i++) {
      const c = table.columns[i];
      const w = colWidths[i];
      const text = cellText(row[c.key]).slice(0, Math.max(6, Math.floor(w / 4.5)));
      const isStatus = c.key.toLowerCase().includes("status");
      page.drawText(text, {
        x: cx,
        y: ctx.y - 8,
        size: 8,
        font: isStatus ? bold : font,
        color: isStatus ? statusColor(text) : TEXT,
      });
      cx += w;
    }
    ctx.y -= rowH;
  });
  ctx.y -= 10;
}

export async function buildReportPdf(opts: {
  title: string;
  subtitle?: string;
  preparedBy?: string;
  periodLabel?: string;
  rightHeader?: string;
  meta?: string[];
  tables?: PdfTable[];
  note?: string;
  footer?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const { width, height } = page.getSize();

  const ctx: DrawCtx = {
    doc,
    page,
    font,
    bold,
    width,
    height,
    y: height - 70,
    pageNum: 1,
    marginX: 40,
    footerLeft:
      opts.footer ||
      "Hama Enterprise Ng  |  Confidential: for admin use only",
  };

  drawHeaderBand(ctx, opts.rightHeader || "Admin Overview Report");

  ctx.page.drawText(opts.title, {
    x: ctx.marginX,
    y: ctx.y,
    size: 16,
    font: bold,
    color: NAVY,
  });
  ctx.y -= 18;

  const periodLine = [
    opts.periodLabel ? `Report period: ${opts.periodLabel}` : null,
    `Generated: ${new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`,
    opts.preparedBy ? `Prepared by: ${opts.preparedBy}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  ctx.page.drawText(periodLine.slice(0, 110), {
    x: ctx.marginX,
    y: ctx.y,
    size: 8,
    font,
    color: MUTED,
  });
  ctx.y -= 14;

  if (opts.note) {
    ctx.page.drawText(opts.note.slice(0, 110), {
      x: ctx.marginX,
      y: ctx.y,
      size: 7,
      font,
      color: MUTED,
    });
    ctx.y -= 12;
  }

  if (opts.meta?.length) {
    ensureSpace(ctx, opts.meta.length * 11 + 8);
    for (const m of opts.meta) {
      ctx.page.drawText(m.slice(0, 100), {
        x: ctx.marginX,
        y: ctx.y,
        size: 9,
        font,
        color: TEXT,
      });
      ctx.y -= 11;
    }
    ctx.y -= 6;
  }

  ctx.page.drawText(`Payment method: ${PAYMENT_METHOD_LABEL}`, {
    x: ctx.marginX,
    y: ctx.y,
    size: 9,
    font: bold,
    color: NAVY,
  });
  ctx.y -= 16;

  if (opts.tables?.length) {
    let section = 1;
    for (const t of opts.tables) {
      drawTable(ctx, {
        ...t,
        sectionNumber: t.sectionNumber ?? section++,
        title: t.title || "Section",
      });
    }
  }

  addFooter(ctx);
  return doc.save();
}

/** Sync fallback for residual callers */
export function buildTextPdf(opts: {
  title: string;
  subtitle?: string;
  lines?: string[];
  tables?: PdfTable[];
  footer?: string;
  meta?: string[];
}): Uint8Array {
  const lines: string[] = [];
  if (opts.meta) lines.push(...opts.meta, "");
  if (opts.tables) {
    for (const t of opts.tables) {
      if (t.title) lines.push(t.title.toUpperCase());
      lines.push(t.columns.map((c) => c.header).join(" | "));
      for (const r of t.rows) {
        lines.push(t.columns.map((c) => cellText(r[c.key])).join(" | "));
      }
      lines.push("");
    }
  }
  if (opts.lines) lines.push(...opts.lines);
  const content = `BT /F1 10 Tf 40 750 Td (${String(opts.title).replace(/[()\\]/g, "")} ) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length ${content.length} >>stream
${content}
endstream endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000349 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
422
%%EOF`;
  return new TextEncoder().encode(pdf);
}
