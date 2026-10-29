/** Multi-page text PDF (Helvetica). No native deps — works on Vercel. */

function escapePdfText(s: string): string {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, (ch) => {
      // keep basic punctuation; strip other unicode for Type1 Helvetica
      if (ch === "\t") return " ";
      return "?";
    });
}

export function money(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return (v < 0 ? "-" : "") + "$" + Math.abs(v).toFixed(2);
}

export function buildTextPdf(opts: {
  title: string;
  subtitle?: string;
  lines: string[];
  footer?: string;
}): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 40;
  const marginTop = 50;
  const marginBottom = 40;
  const fontSize = 9;
  const lineHeight = 12;
  const usable = pageHeight - marginTop - marginBottom;
  const linesPerPage = Math.max(20, Math.floor(usable / lineHeight) - 4);

  const headerLines = [
    opts.title,
    opts.subtitle || "",
    `Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
    "-".repeat(90),
  ].filter((x) => x !== undefined && x !== null);

  const all = [...headerLines, ...opts.lines];
  const pages: string[][] = [];
  for (let i = 0; i < all.length; i += linesPerPage) {
    pages.push(all.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push(["(empty report)"]);

  const contentObjects: string[] = [];
  for (let p = 0; p < pages.length; p++) {
    const lines = pages[p];
    const ops: string[] = [];
    ops.push("BT");
    ops.push(`/F1 ${fontSize} Tf`);
    let y = pageHeight - marginTop;
    for (const line of lines) {
      const safe = escapePdfText(line.slice(0, 110));
      ops.push(`1 0 0 1 ${marginX} ${y} Tm (${safe}) Tj`);
      y -= lineHeight;
    }
    // footer
    const foot = escapePdfText(
      (opts.footer || "Hama Construction — Building innovation through quality and trust") +
        `  |  Page ${p + 1} of ${pages.length}`
    );
    ops.push(`/F1 8 Tf`);
    ops.push(`1 0 0 1 ${marginX} 24 Tm (${foot}) Tj`);
    ops.push("ET");
    contentObjects.push(ops.join("\n"));
  }

  // Build PDF with correct byte offsets
  const chunks: { offset: number; body: string }[] = [];
  let buf = "%PDF-1.4\n";

  const add = (body: string) => {
    const offset = byteLen(buf);
    chunks.push({ offset, body });
    buf += body;
  };

  // obj 1 Catalog
  add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // obj 2 Pages — kids 3..(2+pageCount) are page objects; content starts after
  const pageCount = pages.length;
  const pageObjNums = Array.from({ length: pageCount }, (_, i) => 3 + i);
  const contentStart = 3 + pageCount; // first content stream object number
  const fontObj = contentStart + pageCount; // font after all content streams

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
    add(`${contentObj} 0 obj\n<< /Length ${len} >>\nstream\n${stream}\nendstream\nendobj\n`);
  }

  add(`${fontObj} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  const xrefPos = byteLen(buf);
  const totalObjs = fontObj; // highest object number
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

/** Bank-statement style column helper */
export function col(date: string, desc: string, debit: string, credit: string, balance: string): string {
  const d = (date || "").padEnd(12).slice(0, 12);
  const de = (desc || "").padEnd(36).slice(0, 36);
  const dr = (debit || "").padStart(12).slice(-12);
  const cr = (credit || "").padStart(12).slice(-12);
  const bal = (balance || "").padStart(12).slice(-12);
  return `${d} ${de} ${dr} ${cr} ${bal}`;
}
