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
    const label = start.toLocaleString("en-GB", { month: "long", year: "numeric" });
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
          { key: "joined", header: "Joined", width: 2 },
          { key: "name", header: "Name", width: 3 },
          { key: "email", header: "Email", width: 4 },
          { key: "status", header: "Status", width: 2.5 },
          { key: "counts", header: "Res / Pays", width: 2 },
        ],
        rows: users.map((u) => ({
          joined: u.createdAt.toISOString().slice(0, 10),
          name: u.name || "—",
          email: u.email || "",
          status: `${u.status}`,
          counts: `r${u._count.reservations} / p${u._count.payments}`,
        })),
      };

      const pdf = await buildReportPdf({
        title: "Client Register",
        periodLabel: label,
        preparedBy: session.email,
        rightHeader: "Client Register",
        tables: [clientsTable],
        footer: "Hama Enterprise Ng  |  Confidential: for admin use only",
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

    const [clientCount, reservations, payments, deals, pendingPayments, overdueCount] =
      await Promise.all([
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
          include: {
            user: { select: { name: true, email: true } },
            reservation: { include: { asset: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 300,
        }),
        prisma.project
          .findMany({
            where: {
              status: { in: ["DEAL_PENDING", "DEAL_ACCEPTED", "DEAL_REJECTED"] },
              ...dateFilter,
            },
            include: { client: { select: { name: true, email: true } } },
            orderBy: { createdAt: "desc" },
            take: 100,
          })
          .catch(() => [] as any[]),
        prisma.payment.count({
          where: { status: "PENDING", ...dateFilter },
        }),
        prisma.reservation
          .count({
            where: {
              paymentType: "INSTALLMENT",
              nextDueAt: { lt: new Date() },
              status: {
                in: ["PENDING", "PARTIALLY_PAID", "INSTALLMENT_PLAN", "CONFIRMED"],
              },
            },
          })
          .catch(() => 0),
      ]);

    let approvedTotal = 0;
    for (const p of payments) {
      if (
        p.type !== "REFUND" &&
        (p.status === "APPROVED" || p.status === "COMPLETED")
      ) {
        approvedTotal += Number(p.amount) || 0;
      }
    }

    const activeReservations = reservations.filter((r) =>
      ["PENDING", "CONFIRMED", "PARTIALLY_PAID", "INSTALLMENT_PLAN", "ACTIVE"].includes(
        String(r.status)
      )
    ).length;

    const installmentPlans = reservations.filter(
      (r) =>
        r.paymentType === "INSTALLMENT" ||
        String(r.status).includes("INSTALLMENT")
    );

    const summaryTable: PdfTable = {
      title: "Summary",
      columns: [
        { key: "m1", header: "Measure", width: 3 },
        { key: "v1", header: "Value", width: 2 },
        { key: "m2", header: "Measure", width: 3 },
        { key: "v2", header: "Value", width: 2 },
      ],
      rows: [
        {
          m1: "Total clients",
          v1: String(clientCount),
          m2: "Active reservations",
          v2: String(activeReservations),
        },
        {
          m1: "Pending payments",
          v1: String(pendingPayments),
          m2: "Active installment plans",
          v2: String(installmentPlans.length),
        },
        {
          m1: "Payments listed",
          v1: String(payments.length),
          m2: "Overdue payments",
          v2: String(overdueCount),
        },
        {
          m1: "Project deals",
          v1: String(deals.length),
          m2: "Revenue (approved)",
          v2: money(approvedTotal),
        },
      ],
    };

    const paymentsTable: PdfTable = {
      title: "Payment ledger",
      columns: [
        { key: "ref", header: "Ref / Date", width: 2.2 },
        { key: "client", header: "Client", width: 2.5 },
        { key: "service", header: "Service", width: 2.2 },
        { key: "amount", header: "Amount", width: 2 },
        { key: "method", header: "Method", width: 2.2 },
        { key: "status", header: "Status", width: 1.8 },
      ],
      rows: payments.slice(0, 80).map((p) => ({
        ref: p.createdAt.toISOString().slice(0, 10),
        client: (p.user?.name || p.user?.email || "—").slice(0, 22),
        service: (p.reservation?.asset?.title || p.type || "—").slice(0, 18),
        amount: money(p.amount),
        method: PAYMENT_METHOD_LABEL,
        status: String(p.status || ""),
      })),
    };

    const installmentsTable: PdfTable = {
      title: "Installment plans",
      columns: [
        { key: "client", header: "Client", width: 2.5 },
        { key: "service", header: "Service", width: 2.2 },
        { key: "total", header: "Total price", width: 2 },
        { key: "paid", header: "Paid", width: 2 },
        { key: "balance", header: "Balance", width: 2 },
        { key: "status", header: "Status", width: 1.8 },
      ],
      rows: installmentPlans.slice(0, 40).map((r) => {
        const total =
          Number((r as any).installmentTotal) ||
          Number((r as any).totalAmount) ||
          0;
        const paid =
          Number((r as any).installmentPaid) ||
          Number((r as any).amountPaid) ||
          0;
        return {
          client: (r.user?.name || "—").slice(0, 22),
          service: (r.asset?.title || "—").slice(0, 18),
          total: money(total),
          paid: money(paid),
          balance: money(Math.max(0, total - paid)),
          status: String(r.status || ""),
        };
      }),
    };

    const reservationsTable: PdfTable = {
      title: "Reservations",
      columns: [
        { key: "date", header: "Date", width: 2 },
        { key: "client", header: "Client", width: 2.5 },
        { key: "asset", header: "Asset", width: 3 },
        { key: "status", header: "Status", width: 2 },
        { key: "method", header: "Method", width: 2.2 },
        { key: "paid", header: "Paid", width: 2 },
      ],
      rows: reservations.slice(0, 60).map((r) => ({
        date: r.createdAt.toISOString().slice(0, 10),
        client: (r.user?.name || "—").slice(0, 20),
        asset: (r.asset?.title || "—").slice(0, 24),
        status: String(r.status || ""),
        method: PAYMENT_METHOD_LABEL,
        paid: money(
          (r as any).installmentPaid || (r as any).amountPaid || 0
        ),
      })),
    };

    const pdf = await buildReportPdf({
      title: "Admin Overview Report",
      periodLabel: label,
      preparedBy: session.email || "Admin",
      rightHeader: "Admin Overview Report",
      tables: [summaryTable, paymentsTable, installmentsTable, reservationsTable],
      footer: "Hama Enterprise Ng  |  Confidential: for admin use only",
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
