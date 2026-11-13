import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  buildReportPdf,
  money,
  PAYMENT_METHOD_LABEL,
  type PdfTable,
} from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    let balance = 0;
    const paymentRows = payments.map((p) => {
      const isRefund = p.type === "REFUND";
      const amt = Number(p.amount) || 0;
      if (!isRefund && (p.status === "APPROVED" || p.status === "COMPLETED")) {
        balance += amt;
      } else if (isRefund && (p.status === "APPROVED" || p.status === "COMPLETED")) {
        balance -= amt;
      }
      return {
        date: p.createdAt.toISOString().slice(0, 10),
        narration: String(p.type || "PAYMENT"),
        method: PAYMENT_METHOD_LABEL,
        debit: isRefund ? money(amt) : "—",
        credit: !isRefund ? money(amt) : "—",
        status: String(p.status || ""),
        balance: money(balance),
      };
    });

    const paymentsTable: PdfTable = {
      title: "Payment ledger",
      columns: [
        { key: "date", header: "Date", width: 2 },
        { key: "narration", header: "Narration", width: 2.5 },
        { key: "method", header: "Method", width: 2.2 },
        { key: "debit", header: "Debit", width: 1.8 },
        { key: "credit", header: "Credit", width: 1.8 },
        { key: "status", header: "Status", width: 1.8 },
        { key: "balance", header: "Balance", width: 2 },
      ],
      rows: paymentRows,
    };

    const reservationsTable: PdfTable = {
      title: "Reservations",
      columns: [
        { key: "date", header: "Date", width: 2 },
        { key: "asset", header: "Asset", width: 3 },
        { key: "status", header: "Status", width: 2 },
        { key: "method", header: "Method", width: 2.2 },
        { key: "total", header: "Total", width: 2 },
        { key: "paid", header: "Paid", width: 2 },
      ],
      rows: reservations.map((r) => ({
        date: r.createdAt.toISOString().slice(0, 10),
        asset: (r.asset?.title || "Asset").slice(0, 28),
        status: String(r.status || ""),
        method: PAYMENT_METHOD_LABEL,
        total: money((r as any).totalAmount || (r as any).deposit || 0),
        paid: money((r as any).amountPaid || (r as any).installmentPaid || 0),
      })),
    };

    const rentalsTable: PdfTable = {
      title: "Tool rentals",
      columns: [
        { key: "date", header: "Date", width: 2 },
        { key: "tool", header: "Tool", width: 3.5 },
        { key: "status", header: "Status", width: 2 },
        { key: "method", header: "Method", width: 2.2 },
        { key: "cost", header: "Cost", width: 2 },
      ],
      rows: rentals.map((t) => ({
        date: t.createdAt.toISOString().slice(0, 10),
        tool: (t.tool?.name || "Tool").slice(0, 28),
        status: String(t.status || ""),
        method: PAYMENT_METHOD_LABEL,
        cost: money(t.totalCost),
      })),
    };

    const hiresTable: PdfTable = {
      title: "Hire requests",
      columns: [
        { key: "date", header: "Date", width: 2 },
        { key: "worker", header: "Worker / service", width: 3.5 },
        { key: "status", header: "Status", width: 2 },
        { key: "method", header: "Method", width: 2.2 },
        { key: "cost", header: "Est. cost", width: 2 },
      ],
      rows: hires.map((h) => ({
        date: h.createdAt.toISOString().slice(0, 10),
        worker: (h.worker?.name || h.serviceType || "Hire").slice(0, 28),
        status: String(h.status || ""),
        method: PAYMENT_METHOD_LABEL,
        cost: money(h.estimatedCost || 0),
      })),
    };

    const projectsTable: PdfTable = {
      title: "Project deals",
      columns: [
        { key: "date", header: "Date", width: 2 },
        { key: "title", header: "Title", width: 4 },
        { key: "status", header: "Status", width: 2.5 },
        { key: "budget", header: "Budget", width: 2 },
      ],
      rows: projects.map((p) => ({
        date: p.createdAt.toISOString().slice(0, 10),
        title: (p.title || "").slice(0, 36),
        status: String(p.status || ""),
        budget: money(p.budget),
      })),
    };

    const pdf = await buildReportPdf({
      title: "Account Statement",
      periodLabel: "Full account history",
      preparedBy: session.role === "ADMIN" ? session.email : user.name,
      rightHeader: "Account Statement",
      meta: [
        `Account holder: ${user.name}`,
        `Email: ${user.email}  ·  Phone: ${user.phone || "—"}`,
        `Status: ${user.status} / ${user.verificationStatus}  ·  Member since: ${user.createdAt.toISOString().slice(0, 10)}`,
        `Running paid balance: ${money(balance)}`,
      ],
      tables: [
        paymentsTable,
        reservationsTable,
        rentalsTable,
        hiresTable,
        projectsTable,
      ],
      note: "System-generated for Hama Construction records. Not a bank instrument.",
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
