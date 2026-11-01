import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendEmail, quoteReceivedHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      phone,
      projectType,
      location,
      budgetRange,
      timeline,
      description,
    } = body;

    if (!name || !email || !projectType || !description) {
      return NextResponse.json(
        { error: "Name, email, project type and description are required" },
        { status: 400 }
      );
    }

    const quote = await prisma.quoteRequest.create({
      data: {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        phone: phone ? String(phone).trim() : null,
        projectType: String(projectType),
        location: location ? String(location) : null,
        budgetRange: budgetRange ? String(budgetRange) : null,
        timeline: timeline ? String(timeline) : null,
        description: String(description).trim(),
        status: "NEW",
      },
    });

    await sendEmail({
      to: quote.email,
      subject: "We received your quote request — Hama Construction",
      html: quoteReceivedHtml(quote.name),
    }).catch(() => null);

    const adminEmail = process.env.ADMIN_EMAIL || process.env.NOTIFY_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `New quote: ${quote.projectType} from ${quote.name}`,
        html: `<p><strong>${quote.name}</strong> (${quote.email}) requested a quote.</p>
<p>Type: ${quote.projectType}<br/>Location: ${quote.location || "—"}<br/>Budget: ${quote.budgetRange || "—"}</p>
<p>${quote.description}</p>`,
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      id: quote.id,
      message: "Quote request submitted. We will contact you soon.",
    });
  } catch (e) {
    console.error("quote", e);
    return NextResponse.json({ error: "Failed to submit quote" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const status = new URL(req.url).searchParams.get("status");
  const quotes = await prisma.quoteRequest.findMany({
    where: status && status !== "ALL" ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(quotes);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const { id, status, adminNote } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const updated = await prisma.quoteRequest.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        ...(adminNote !== undefined ? { adminNote } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
