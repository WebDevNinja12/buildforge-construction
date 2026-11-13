import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildTextPdf, money, PAYMENT_METHOD_LABEL, type PdfTable } from "@/lib/pdf";

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
        narration: `${p.type || "PAYMENT"}`.slice(0, 20),
        method: PAYMENT_METHOD_LABEL,
        debit: isRefund ? money(amt) : "",
        credit: !isRefund ? money(amt) : "",
        status: String(p.status || "").slice(0, 12),
        balance: money(balance),
      };
    });

    const paymentsTable: PdfTable = {
      title: "Payment ledger",
      columns: [
        { key: "date", header: "DATE", width: 11 },
        { key: "narration", header: "NARRATION", width: 18 },
        { key: "method", header: "METHOD", width: 14 },
        { key: "debit", header: "DEBIT", width: 12, align: "right" },
        { key: "credit", header: "CREDIT", width: 12, align: "right" },
        { key: "status", header: "STATUS", width: 12 },
        { key: "balance", header: "BALANCE", width: 14, align: "right" },
      ],
      rows: paymentRows,
    };

    const reservationsTable: PdfTable = {
      title: "Reservations",
      columns: [
        { key: "date", header: "DATE", width: 11 },
        { key: "asset", header: "ASSET", width: 22 },
        { key: "status", header: "STATUS", width: 14 },
        { key: "method", header: "METHOD", width: 14 },
        { key: "total", header: "TOTAL", width: 12, align: "right" },
        { key: "paid", header: "PAID", width: 12, align: "right" },
      ],
      rows: reservations.map((r) => ({
        date: r.createdAt.toISOString().slice(0, 10),
        asset: (r.asset?.title || "Asset").slice(0, 22),
        status: String(r.status || "").slice(0, 14),
        method: PAYMENT_METHOD_LABEL,
        total: money((r as any).totalAmount || (r as any).deposit || 0),
        paid: money((r as any).amountPaid || (r as any).installmentPaid || 0),
      })),
    };

    const rentalsTable: PdfTable = {
      title: "Tool rentals",
      columns: [
        { key: "date", header: "DATE", width: 11 },
        { key: "tool", header: "TOOL", width: 24 },
        { key: "status", header: "STATUS", width: 14 },
        { key: "method", header: "METHOD", width: 14 },
        { key: "cost", header: "COST", width: 14, align: "right" },
      ],
      rows: rentals.map((t) => ({
        date: t.createdAt.toISOString().slice(0, 10),
        tool: (t.tool?.name || "Tool").slice(0, 24),
        status: String(t.status || "").slice(0, 14),
        method: PAYMENT_METHOD_LABEL,
        cost: money(t.totalCost),
      })),
    };

    const hiresTable: PdfTable = {
      title: "Hire requests",
      columns: [
        { key: "date", header: "DATE", width: 11 },
        { key: "worker", header: "WORKER / SERVICE", width: 26 },
        { key: "status", header: "STATUS", width: 14 },
        { key: "method", header: "METHOD", width: 14 },
        { key: "cost", header: "EST. COST", width: 14, align: "right" },
      ],
      rows: hires.map((h) => ({
        date: h.createdAt.toISOString().slice(0, 10),
        worker: (h.worker?.name || h.serviceType || "Hire").slice(0, 26),
        status: String(h.status || "").slice(0, 14),
        method: PAYMENT_METHOD_LABEL,
        cost: money(h.estimatedCost || 0),
      })),
    };

    const projectsTable: PdfTable = {
      title: "Project deals",
      columns: [
        { key: "date", header: "DATE", width: 11 },
        { key: "title", header: "TITLE", width: 28 },
        { key: "status", header: "STATUS", width: 16 },
        { key: "budget", header: "BUDGET", width: 14, align: "right" },
      ],
      rows: projects.map((p) => ({
        date: p.createdAt.toISOString().slice(0, 10),
        title: (p.title || "").slice(0, 28),
        status: String(p.status || "").slice(0, 16),
        budget: money(p.budget),
      })),
    };

    const pdf = buildTextPdf({
      title: "HAMA CONSTRUCTION — ACCOUNT STATEMENT",
      subtitle:
        session.role === "ADMIN"
          ? `Admin export for ${user.email}`
          : `Client statement · ${user.email}`,
      meta: [
        `Account holder : ${user.name}`,
        `Email          : ${user.email}`,
        `Phone          : ${user.phone || "—"}`,
        `Account status : ${user.status} / ${user.verificationStatus}`,
        `Member since   : ${user.createdAt.toISOString().slice(0, 10)}`,
        `Payment method : ${PAYMENT_METHOD_LABEL}`,
        `Running paid balance : ${money(balance)}`,
      ],
      tables: [paymentsTable, reservationsTable, rentalsTable, hiresTable, projectsTable],
      lines: [
        "This statement is system-generated for Hama Construction records.",
        "Motivated by quality and trust — not a bank instrument.",
      ],
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
