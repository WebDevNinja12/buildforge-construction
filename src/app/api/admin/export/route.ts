import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildTextPdf, money, col } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Admin overview / clients PDF (statement style) */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const type = new URL(req.url).searchParams.get("type") || "overview";

    if (type === "clients") {
      const users = await prisma.user.findMany({
        where: { role: "CLIENT", deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: {
          name: true,
          email: true,
          phone: true,
          status: true,
          verificationStatus: true,
          createdAt: true,
          _count: { select: { reservations: true, payments: true } },
        },
      });
      const lines: string[] = [];
      lines.push("CLIENT REGISTER");
      lines.push(
        col("JOINED", "NAME / EMAIL", "STATUS", "RES", "PAYS")
      );
      lines.push("-".repeat(90));
      for (const u of users) {
        lines.push(
          `${u.createdAt.toISOString().slice(0, 10)}  ${(u.name || "").slice(0, 20)}  ${u.email}  | ${u.status}/${u.verificationStatus} | r${u._count.reservations} p${u._count.payments} | ${u.phone || ""}`
        );
      }
      if (!users.length) lines.push("(no clients)");

      const pdf = buildTextPdf({
        title: "HAMA CONSTRUCTION — CLIENT REGISTER",
        subtitle: `Exported by ${session.email}`,
        lines,
      });
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="hama-clients-${Date.now()}.pdf"`,
          "Cache-Control": "no-store",
          "Content-Length": String(pdf.byteLength),
        },
      });
    }

    // Full business statement overview
    const [clientCount, reservations, payments, deals] = await Promise.all([
      prisma.user.count({ where: { role: "CLIENT", deletedAt: null } }),
      prisma.reservation.findMany({
        include: { asset: true, user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 80,
      }),
      prisma.payment.findMany({
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
        take: 120,
      }),
      prisma.project.findMany({
        where: { status: { in: ["DEAL_PENDING", "DEAL_ACCEPTED", "DEAL_REJECTED"] } },
        include: { client: { select: { name: true, email: true, phone: true } } },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);

    const lines: string[] = [];
    lines.push("BUSINESS OVERVIEW STATEMENT");
    lines.push(`Total clients           : ${clientCount}`);
    lines.push(`Reservations listed     : ${reservations.length}`);
    lines.push(`Payments listed         : ${payments.length}`);
    lines.push(`Project deals listed    : ${deals.length}`);
    lines.push("");

    lines.push("PAYMENT LEDGER");
    lines.push(col("DATE", "CLIENT / TYPE", "DEBIT", "CREDIT", "STATUS"));
    lines.push("-".repeat(90));
    let approvedTotal = 0;
    for (const p of payments) {
      const date = p.createdAt.toISOString().slice(0, 10);
      const desc = `${(p.user?.name || "").slice(0, 14)} ${p.type}`.slice(0, 36);
      const amt = money(p.amount);
      if (p.type === "REFUND") {
        lines.push(col(date, desc, amt, "", p.status));
      } else {
        lines.push(col(date, desc, "", amt, p.status));
        if (p.status === "APPROVED" || p.status === "COMPLETED") approvedTotal += Number(p.amount) || 0;
      }
    }
    if (!payments.length) lines.push("(no payments)");
    lines.push("-".repeat(90));
    lines.push(`Approved payment volume : ${money(approvedTotal)}`);
    lines.push("");

    lines.push("RESERVATIONS");
    lines.push("-".repeat(90));
    for (const r of reservations) {
      lines.push(
        `${r.createdAt.toISOString().slice(0, 10)}  ${r.user?.name || "?"}  | ${r.asset?.title || ""}  | ${r.status} | ${money(r.totalAmount || r.deposit)} paid ${money(r.amountPaid)}`
      );
    }
    if (!reservations.length) lines.push("(none)");
    lines.push("");

    lines.push("PROJECT DEALS");
    lines.push("-".repeat(90));
    for (const d of deals) {
      lines.push(
        `${d.createdAt.toISOString().slice(0, 10)}  ${d.client?.name} ${d.client?.email} ${d.client?.phone || ""}  | ${d.title}  | ${d.status} | ${money(d.budget)}`
      );
    }
    if (!deals.length) lines.push("(none)");

    const pdf = buildTextPdf({
      title: "HAMA CONSTRUCTION — ADMIN OVERVIEW STATEMENT",
      subtitle: `Exported by ${session.email}`,
      lines,
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hama-admin-statement-${Date.now()}.pdf"`,
        "Cache-Control": "no-store",
        "Content-Length": String(pdf.byteLength),
      },
    });
  } catch (e) {
    console.error("admin export", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 }
    );
  }
}
