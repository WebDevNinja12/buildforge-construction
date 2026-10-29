import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildTextPdf, money, col } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Client or admin downloads bank-statement style account history PDF */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized — please login" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    let userId = session.id;
    if (session.role === "ADMIN" && searchParams.get("userId")) {
      userId = searchParams.get("userId")!;
    }
    if (session.role !== "ADMIN" && userId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        verificationStatus: true,
        createdAt: true,
      },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [reservations, rentals, hires, payments, projects] = await Promise.all([
      prisma.reservation.findMany({
        where: { userId },
        include: { asset: true },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      prisma.toolRental.findMany({
        where: { userId },
        include: { tool: true },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      prisma.hireRequest.findMany({
        where: { userId },
        include: { worker: true },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        take: 150,
      }),
      prisma.project.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: "asc" },
        take: 30,
      }),
    ]);

    const lines: string[] = [];
    lines.push("ACCOUNT STATEMENT");
    lines.push(`Account holder : ${user.name}`);
    lines.push(`Email          : ${user.email}`);
    lines.push(`Phone          : ${user.phone || "—"}`);
    lines.push(`Account status : ${user.status} / ${user.verificationStatus}`);
    lines.push(`Member since   : ${user.createdAt.toISOString().slice(0, 10)}`);
    lines.push("");

    // Payment ledger (bank-style)
    lines.push("PAYMENT LEDGER (chronological)");
    lines.push(
      col("DATE", "DESCRIPTION", "DEBIT", "CREDIT", "BALANCE")
    );
    lines.push("-".repeat(90));

    let balance = 0;
    let totalIn = 0;
    let totalOut = 0;

    if (payments.length === 0) {
      lines.push("(no payment transactions)");
    } else {
      for (const p of payments) {
        const date = p.createdAt.toISOString().slice(0, 10);
        const desc = `${p.type} ${p.status} ${p.method || ""}`.trim().slice(0, 36);
        const amt = Number(p.amount) || 0;
        // Credits = money received/approved toward account; debits = refunds out
        let debit = "";
        let credit = "";
        if (p.type === "REFUND") {
          debit = money(amt);
          balance -= amt;
          totalOut += amt;
        } else {
          // treat completed/approved as credit to "paid" balance tracking
          credit = money(amt);
          if (p.status === "APPROVED" || p.status === "COMPLETED" || p.status === "CONFIRMED") {
            balance += amt;
            totalIn += amt;
          }
        }
        lines.push(col(date, desc, debit, credit, money(balance)));
      }
    }

    lines.push("-".repeat(90));
    lines.push(`Total credits (approved) : ${money(totalIn)}`);
    lines.push(`Total debits (refunds)   : ${money(totalOut)}`);
    lines.push(`Running paid balance     : ${money(balance)}`);
    lines.push("");

    lines.push("RESERVATIONS");
    lines.push("-".repeat(90));
    if (!reservations.length) lines.push("(none)");
    for (const r of reservations) {
      lines.push(
        `${r.createdAt.toISOString().slice(0, 10)}  ${r.asset?.title || "Asset"}  | ${r.status} | ${r.paymentMethod} | total ${money(r.totalAmount || r.deposit)} paid ${money(r.amountPaid)}`
      );
    }
    lines.push("");

    lines.push("TOOL RENTALS");
    lines.push("-".repeat(90));
    if (!rentals.length) lines.push("(none)");
    for (const t of rentals) {
      lines.push(
        `${t.createdAt.toISOString().slice(0, 10)}  ${t.tool?.name || "Tool"}  | ${t.status} | ${money(t.totalCost)}`
      );
    }
    lines.push("");

    lines.push("HIRE REQUESTS");
    lines.push("-".repeat(90));
    if (!hires.length) lines.push("(none)");
    for (const h of hires) {
      lines.push(
        `${h.createdAt.toISOString().slice(0, 10)}  ${h.worker?.name || h.serviceType}  | ${h.status} | ${money(h.estimatedCost || 0)}`
      );
    }
    lines.push("");

    lines.push("PROJECT DEALS");
    lines.push("-".repeat(90));
    if (!projects.length) lines.push("(none)");
    for (const p of projects) {
      lines.push(
        `${p.createdAt.toISOString().slice(0, 10)}  ${p.title}  | ${p.status} | budget ${money(p.budget)}`
      );
    }
    lines.push("");
    lines.push("This statement is system-generated for Hama Construction records.");
    lines.push("Motivated by quality and trust — not a bank instrument.");

    const pdf = buildTextPdf({
      title: "HAMA CONSTRUCTION — ACCOUNT STATEMENT",
      subtitle:
        session.role === "ADMIN"
          ? `Admin export for ${user.email}`
          : `Client statement · ${user.email}`,
      lines,
      footer: "Hama Construction | Building innovation through quality and trust",
    });

    const filename = `hama-statement-${user.email.replace(/[^a-z0-9]/gi, "_")}-${Date.now()}.pdf`;

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "Content-Length": String(pdf.byteLength),
      },
    });
  } catch (e) {
    console.error("history export", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 }
    );
  }
}
