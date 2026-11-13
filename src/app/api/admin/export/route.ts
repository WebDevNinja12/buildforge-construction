import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildTextPdf, money, PAYMENT_METHOD_LABEL, type PdfTable } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Period = "monthly" | "quarterly" | "annual" | "all";

function parsePeriod(raw: string | null): Period {
  const p = String(raw || "all").toLowerCase();
  if (p === "monthly" || p === "month") return "monthly";
  if (p === "quarterly" || p === "quarter") return "quarterly";
  if (p === "annual" || p === "yearly" || p === "year") return "annual";
  return "all";
}

function periodRange(
  period: Period,
  year: number,
  month?: number,
  quarter?: number
): { start: Date | null; end: Date | null; label: string } {
  if (period === "all") return { start: null, end: null, label: "All time" };
  if (period === "monthly") {
    const m = Math.min(12, Math.max(1, month || new Date().getMonth() + 1));
    const start = new Date(year, m - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, m, 0, 23, 59, 59, 999);
    const label = start.toLocaleString("en-US", { month: "long", year: "numeric" });
    return { start, end, label };
  }
  if (period === "quarterly") {
    const q = Math.min(4, Math.max(1, quarter || Math.floor(new Date().getMonth() / 3) + 1));
    const start = new Date(year, (q - 1) * 3, 1, 0, 0, 0, 0);
    const end = new Date(year, (q - 1) * 3 + 3, 0, 23, 59, 59, 999);
    return { start, end, label: `Q${q} ${year}` };
  }
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { start, end, label: `Year ${year}` };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const sp = new URL(req.url).searchParams;
    const type = sp.get("type") || "overview";
    const period = parsePeriod(sp.get("period"));
    const year = Math.min(
      2100,
      Math.max(2020, Number(sp.get("year")) || new Date().getFullYear())
    );
    const month = Number(sp.get("month")) || undefined;
    const quarter = Number(sp.get("quarter")) || undefined;
    const { start, end, label } = periodRange(period, year, month, quarter);
    const dateFilter = start && end ? { createdAt: { gte: start, lte: end } } : {};

    if (type === "clients") {
      const users = await prisma.user.findMany({
        where: { role: "CLIENT", deletedAt: null, ...dateFilter },
        orderBy: { createdAt: "desc" },
        take: 500,
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

      const clientsTable: PdfTable = {
        title: "Client register",
        columns: [
          { key: "joined", header: "JOINED", width: 12 },
          { key: "name", header: "NAME", width: 18 },
          { key: "email", header: "EMAIL", width: 28 },
          { key: "status", header: "STATUS", width: 14 },
          { key: "counts", header: "RES/PAY", width: 10, align: "right" },
        ],
        rows: users.map((u) => ({
          joined: u.createdAt.toISOString().slice(0, 10),
          name: (u.name || "").slice(0, 18),
          email: (u.email || "").slice(0, 28),
          status: `${u.status}/${u.verificationStatus}`.slice(0, 14),
          counts: `r${u._count.reservations} p${u._count.payments}`,
        })),
      };

      const pdf = buildTextPdf({
        title: "HAMA CONSTRUCTION — CLIENT REGISTER",
        subtitle: `Period: ${label} · Exported by ${session.email}`,
        meta: [
          `Payment method: ${PAYMENT_METHOD_LABEL}`,
          `Clients in period: ${users.length}`,
        ],
        tables: [clientsTable],
      });
      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="hama-clients-${period}-${year}-${Date.now()}.pdf"`,
          "Cache-Control": "no-store",
          "Content-Length": String(pdf.byteLength),
        },
      });
    }

    const [clientCount, reservations, payments, deals] = await Promise.all([
      prisma.user.count({
        where: { role: "CLIENT", deletedAt: null, ...dateFilter },
      }),
      prisma.reservation.findMany({
        where: { ...dateFilter },
        include: { asset: true, user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.payment.findMany({
        where: { ...dateFilter },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 300,
      }),
      prisma.project
        .findMany({
          where: {
            status: { in: ["DEAL_PENDING", "DEAL_ACCEPTED", "DEAL_REJECTED"] },
            ...dateFilter,
          },
          include: { client: { select: { name: true, email: true, phone: true } } },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
        .catch(() => [] as any[]),
    ]);

    let approvedTotal = 0;
    const paymentRows = payments.map((p) => {
      const isRefund = p.type === "REFUND";
      const amt = Number(p.amount) || 0;
      if (!isRefund && (p.status === "APPROVED" || p.status === "COMPLETED")) {
        approvedTotal += amt;
      }
      return {
        date: p.createdAt.toISOString().slice(0, 10),
        client: (p.user?.name || p.user?.email || "").slice(0, 16),
        type: String(p.type || "").slice(0, 12),
        method: PAYMENT_METHOD_LABEL,
        debit: isRefund ? money(amt) : "",
        credit: !isRefund ? money(amt) : "",
        status: String(p.status || "").slice(0, 12),
      };
    });

    const paymentsTable: PdfTable = {
      title: "Payment ledger",
      columns: [
        { key: "date", header: "DATE", width: 11 },
        { key: "client", header: "CLIENT", width: 16 },
        { key: "type", header: "TYPE", width: 12 },
        { key: "method", header: "METHOD", width: 14 },
        { key: "debit", header: "DEBIT", width: 12, align: "right" },
        { key: "credit", header: "CREDIT", width: 12, align: "right" },
        { key: "status", header: "STATUS", width: 12 },
      ],
      rows: paymentRows,
    };

    const reservationsTable: PdfTable = {
      title: "Reservations",
      columns: [
        { key: "date", header: "DATE", width: 11 },
        { key: "client", header: "CLIENT", width: 16 },
        { key: "asset", header: "ASSET", width: 22 },
        { key: "status", header: "STATUS", width: 14 },
        { key: "method", header: "METHOD", width: 14 },
        { key: "paid", header: "PAID", width: 12, align: "right" },
      ],
      rows: reservations.map((r) => ({
        date: r.createdAt.toISOString().slice(0, 10),
        client: (r.user?.name || "").slice(0, 16),
        asset: (r.asset?.title || "").slice(0, 22),
        status: String(r.status || "").slice(0, 14),
        method: PAYMENT_METHOD_LABEL,
        paid: money((r as any).installmentPaid || (r as any).amountPaid || 0),
      })),
    };

    const dealsTable: PdfTable = {
      title: "Project deals",
      columns: [
        { key: "date", header: "DATE", width: 11 },
        { key: "client", header: "CLIENT", width: 18 },
        { key: "title", header: "TITLE", width: 24 },
        { key: "status", header: "STATUS", width: 14 },
        { key: "budget", header: "BUDGET", width: 14, align: "right" },
      ],
      rows: (deals as any[]).map((d) => ({
        date: d.createdAt.toISOString().slice(0, 10),
        client: (d.client?.name || d.client?.email || "").slice(0, 18),
        title: (d.title || "").slice(0, 24),
        status: String(d.status || "").slice(0, 14),
        budget: money(d.budget),
      })),
    };

    const pdf = buildTextPdf({
      title: "HAMA CONSTRUCTION — ADMIN OVERVIEW STATEMENT",
      subtitle: `Period: ${label} · Exported by ${session.email}`,
      meta: [
        `Payment method: ${PAYMENT_METHOD_LABEL}`,
        `Clients joined: ${clientCount}`,
        `Reservations listed: ${reservations.length}`,
        `Payments listed: ${payments.length}`,
        `Project deals listed: ${deals.length}`,
        `Approved payment volume: ${money(approvedTotal)}`,
      ],
      tables: [paymentsTable, reservationsTable, dealsTable],
      footer: "Hama Construction | Building innovation through quality and trust",
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hama-admin-statement-${period}-${year}-${Date.now()}.pdf"`,
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
