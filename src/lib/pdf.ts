/** Minimal single-page text PDF (no native deps — works on Vercel). */

function escapePdfText(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

export function buildTextPdf(opts: {
  title: string;
  subtitle?: string;
  lines: string[];
}): Uint8Array {
  const pageWidth = 612; // US Letter
  const pageHeight = 792;
  const margin = 50;
  const fontSize = 10;
  const lineHeight = 14;
  const maxLines = Math.floor((pageHeight - margin * 2 - 40) / lineHeight);

  const header = [
    opts.title,
    opts.subtitle || "",
    `Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`,
    "".padEnd(80, "-"),
  ].filter(Boolean);

  const body = [...header, ...opts.lines].slice(0, maxLines);
  const contentLines: string[] = [];
  let y = pageHeight - margin;

  contentLines.push("BT");
  contentLines.push("/F1 " + fontSize + " Tf");
  for (const line of body) {
    const safe = escapePdfText(line.slice(0, 95));
    contentLines.push(`1 0 0 1 ${margin} ${y} Tm (${safe}) Tj`);
    y -= lineHeight;
    if (y < margin) break;
  }
  contentLines.push("ET");
  const stream = contentLines.join("\n");

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`
  );
  objects.push(
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
  );
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

export function money(n: number) {
  return "$" + (Number(n) || 0).toFixed(2);
}
