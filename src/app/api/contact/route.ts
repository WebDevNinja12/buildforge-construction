import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, contactReceivedHtml } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, subject, message } = body;

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Name, email, subject and message are required" },
        { status: 400 }
      );
    }

    await prisma.contactMessage.create({
      data: {
        name,
        email,
        phone: phone || null,
        subject,
        message,
      },
    });

    await sendEmail({
      to: email,
      subject: "We received your message — Hama Construction",
      html: contactReceivedHtml(name),
    }).catch(() => null);

    const adminEmail = process.env.ADMIN_EMAIL || process.env.NOTIFY_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `Contact: ${subject} from ${name}`,
        html: `<p>${name} (${email}) wrote:</p><p>${message}</p>`,
      }).catch(() => null);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact error:", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}
