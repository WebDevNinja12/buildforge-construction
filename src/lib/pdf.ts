/** Multi-page text PDF (Helvetica). No native deps — works on Vercel. */

function escapePdfText(s: string): string {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, (ch) => {
      if (ch === "\t") return " ";
      return "?";
    });
}

/** Naira display (#) as requested for the project currency */
export function money(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + "#" + Math.abs(v).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const PAYMENT_METHOD_LABEL = "Bank Transfer";

function pad(s: string, w: number, align: "left" | "right" = "left"): string {
  const t = String(s ?? "");
  if (t.length >= w) return t.slice(0, w);
  const space = " ".repeat(w - t.length);
  return align === "right" ? space + t : t + space;
}

/** Fixed-width column row (bank-statement style) */
export function col(
  a: string,
  b: string,
  c: string,
  d: string,
  e: string
): string {
  return [
    pad(a, 12),
    pad(b, 28),
    pad(c, 12, "right"),
    pad(d, 12, "right"),
    pad(e, 14, "right"),
  ].join(" ");
}

export type PdfTableColumn = {
  key: string;
  header: string;
  width: number;
  align?: "left" | "right";
};

export type PdfTable = {
  title?: string;
  columns: PdfTableColumn[];
  rows: Record<string, string | number | null | undefined>[];
};

function renderTableLines(table: PdfTable): string[] {
  const lines: string[] = [];
  if (table.title) {
    lines.push(table.title.toUpperCase());
  }
  const header = table.columns
    .map((c) => pad(c.header, c.width, c.align || "left"))
    .join(" ");
  const rule = "-".repeat(Math.min(100, header.length));
  lines.push(header);
  lines.push(rule);
  if (!table.rows.length) {
    lines.push("(none)");
  } else {
    for (const row of table.rows) {
      const cells = table.columns.map((c) => {
        const raw = row[c.key];
        const val =
          raw == null || raw === ""
            ? ""
            : typeof raw === "number"
              ? money(raw)
              : String(raw);
        return pad(val, c.width, c.align || "left");
      });
      lines.push(cells.join(" "));
    }
  }
  lines.push(rule);
  lines.push("");
  return lines;
}

/** Build a multi-page statement PDF. Prefer `tables` for tabular narration. */
export function buildTextPdf(opts: {
  title: string;
  subtitle?: string;
  lines?: string[];
  tables?: PdfTable[];
  footer?: string;
  meta?: string[];
}): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 36;
  const marginTop = 48;
  const marginBottom = 40;
  const fontSize = 9;
  const lineHeight = 11;
  const usable = pageHeight - marginTop - marginBottom;
  const linesPerPage = Math.max(20, Math.floor(usable / lineHeight) - 3);

  const body: string[] = [];
  if (opts.meta?.length) {
    for (const m of opts.meta) body.push(m);
    body.push("");
  }
  if (opts.tables?.length) {
    for (const t of opts.tables) {
      body.push(...renderTableLines(t));
    }
  }
  if (opts.lines?.length) {
    body.push(...opts.lines);
  }

  const headerLines = [
    opts.title,
    opts.subtitle || "",
    `Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
    `Payment method: ${PAYMENT_METHOD_LABEL}`,
    "=".repeat(92),
  ].filter((x) => x !== undefined && x !== null);

  const all = [...headerLines, ...body];
  const pages: string[][] = [];
  for (let i = 0; i < all.length; i += linesPerPage) {
    pages.push(all.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(["(empty report)"]);

  const contentObjects: string[] = [];
  for (let p = 0; p < pages.length; p++) {
    const pageLines = pages[p];
    const ops: string[] = [];
    ops.push("BT");
    ops.push(`/F1 ${fontSize} Tf`);
    let y = pageHeight - marginTop;
    for (const line of pageLines) {
      const safe = escapePdfText(line.slice(0, 118));
      ops.push(`1 0 0 1 ${marginX} ${y} Tm (${safe}) Tj`);
      y -= lineHeight;
    }
    const foot = escapePdfText(
      (opts.footer ||
        "Hama Construction — Building innovation through quality and trust") +
        `  |  Page ${p + 1} of ${pages.length}`
    );
    ops.push(`/F1 8 Tf`);
    ops.push(`1 0 0 1 ${marginX} 24 Tm (${foot}) Tj`);
    ops.push("ET");
    contentObjects.push(ops.join("\n"));
  }

  const chunks: { offset: number; body: string }[] = [];
  let buf = "%PDF-1.4\n";

  const add = (bodyStr: string) => {
    const offset = byteLen(buf);
    chunks.push({ offset, body: bodyStr });
    buf += bodyStr;
  };

  add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const pageCount = pages.length;
  const pageObjNums = Array.from({ length: pageCount }, (_, i) => 3 + i);
  const contentStart = 3 + pageCount;
  const fontObj = contentStart + pageCount;

  const kids = pageObjNums.map((n) => `${n} 0 R`).join(" ");
  add(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`);

  for (let i = 0; i < pageCount; i++) {
    const pageObj = 3 + i;
    const contentObj = contentStart + i;
    add(
      `${pageObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObj} 0 R /Resources << /Font << /F1 ${fontObj} 0 R >> >> >>\nendobj\n`
    );
  }

  for (let i = 0; i < pageCount; i++) {
    const contentObj = contentStart + i;
    const stream = contentObjects[i];
    const len = byteLen(stream);
    add(
      `${contentObj} 0 obj\n<< /Length ${len} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
  }

  add(
    `${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`
  );

  const xrefPos = byteLen(buf);
  const totalObjs = fontObj;
  let xref = `xref\n0 ${totalObjs + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 0; i < chunks.length; i++) {
    xref += String(chunks[i].offset).padStart(10, "0") + " 00000 n \n";
  }
  buf += xref;
  buf += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\n`;
  buf += `startxref\n${xrefPos}\n%%EOF\n`;

  return new TextEncoder().encode(buf);
}

function byteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}
