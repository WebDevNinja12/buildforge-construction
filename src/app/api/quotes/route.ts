import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendEmail, quoteReceivedHtml } from "@/lib/email";
import { healSchema } from "@/lib/schema-heal";

export const dynamic = "force-dynamic";

function buildMessage(parts: {
  description: string;
  location?: string | null;
  budgetRange?: string | null;
  timeline?: string | null;
}) {
  const lines = [String(parts.description || "").trim()];
  if (parts.location) lines.push(`Location: ${parts.location}`);
  if (parts.budgetRange) lines.push(`Budget: ${parts.budgetRange}`);
  if (parts.timeline) lines.push(`Timeline: ${parts.timeline}`);
  return lines.filter(Boolean).join("\n");
}

function mapQuote(q: any) {
  const message = String(q.message || q.description || "");
  const lines = message.split("\n");
  const description = lines[0] || message;
  let location: string | null = q.location || null;
  let budgetRange: string | null = q.budgetRange || null;
  let timeline: string | null = q.timeline || null;
  for (const line of lines.slice(1)) {
    const loc = line.match(/^Location:\s*(.+)$/i);
    const bud = line.match(/^Budget:\s*(.+)$/i);
    const tim = line.match(/^Timeline:\s*(.+)$/i);
    if (loc) location = loc[1].trim();
    if (bud) budgetRange = bud[1].trim();
    if (tim) timeline = tim[1].trim();
  }
  return {
    id: q.id,
    name: q.name,
    email: q.email,
    phone: q.phone,
    projectType: q.projectType || q.service || "General",
    service: q.service || q.projectType || "General",
    location,
    budgetRange,
    timeline,
    description,
    message,
    status: q.status || "NEW",
    adminNote: q.adminNote || null,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

async function ensureQuoteColumns() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS "QuoteRequest" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "phone" TEXT,
      "service" TEXT,
      "message" TEXT NOT NULL DEFAULT '',
      "status" TEXT NOT NULL DEFAULT 'NEW',
      "adminNote" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "phone" TEXT`,
    `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "service" TEXT`,
    `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "message" TEXT`,
    `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'NEW'`,
    `ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "adminNote" TEXT`,
  ];
  for (const sql of stmts) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      /* ignore */
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    await healSchema().catch(() => null);
    await ensureQuoteColumns();

    const body = await req.json();
    const {
      name,
      email,
      phone,
      projectType,
      service,
      location,
      budgetRange,
      timeline,
      description,
      message: rawMessage,
    } = body;

    const type = String(projectType || service || "").trim();
    const desc = String(description || rawMessage || "").trim();

    if (!name || !email || !type || !desc) {
      return NextResponse.json(
        { error: "Name, email, project type and description are required" },
        { status: 400 }
      );
    }

    const message = buildMessage({
      description: desc,
      location,
      budgetRange,
      timeline,
    });

    const data = {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone ? String(phone).trim() : null,
      service: type,
      message,
      status: "NEW",
    };

    let quote: any;
    try {
      quote = await prisma.quoteRequest.create({ data });
    } catch (e1) {
      console.error("quote create failed, re-heal and retry", e1);
      await ensureQuoteColumns();
      quote = await prisma.quoteRequest.create({ data });
    }

    await sendEmail({
      to: data.email,
      subject: "We received your quote request — Hama Construction",
      html: quoteReceivedHtml(data.name),
    }).catch(() => null);

    const adminEmail = process.env.ADMIN_EMAIL || process.env.NOTIFY_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `New quote: ${type} from ${data.name}`,
        html: `<p><strong>${data.name}</strong> (${data.email}) requested a quote.</p>
<p>Type: ${type}<br/>Location: ${location || "—"}<br/>Budget: ${budgetRange || "—"}</p>
<p>${desc.replace(/</g, "<")}</p>`,
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      id: quote.id,
      message: "Quote request submitted. We will contact you soon.",
    });
  } catch (e) {
    console.error("quote", e);
    const msg = e instanceof Error ? e.message : "Failed to submit quote";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    await healSchema().catch(() => null);
    await ensureQuoteColumns();
    const status = new URL(req.url).searchParams.get("status");
    const quotes = await prisma.quoteRequest.findMany({
      where: status && status !== "ALL" ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(quotes.map(mapQuote));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load quotes" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    await ensureQuoteColumns();
    const { id, status, adminNote } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const updated = await prisma.quoteRequest.update({
      where: { id },
      data: {
        ...(status ? { status: String(status) } : {}),
        ...(adminNote !== undefined ? { adminNote: String(adminNote) } : {}),
      },
    });
    return NextResponse.json(mapQuote(updated));
  } catch (e) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
