import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildTextPdf, money, col } from "@/lib/pdf";

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
    const year = Math.min(2100, Math.max(2020, Number(sp.get("year")) || new Date().getFullYear()));
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
      const lines: string[] = [];
      lines.push(`CLIENT REGISTER — ${label}`);
      lines.push(col("JOINED", "NAME / EMAIL", "STATUS", "RES", "PAYS"));
      lines.push("-" .repeat(90));
      for (const u of users) {
        lines.push(
          `${u.createdAt.toISOString().slice(0, 10)}  ${(u.name || "").slice(0, 20)}  ${u.email}  | ${u.status}/${u.verificationStatus} | r${u._count.reservations} p${u._count.payments} | ${u.phone || ""}`
        );
      }
      if (!users.length) lines.push("(no clients in this period)");
      const pdf = buildTextPdf({
        title: "HAMA CONSTRUCTION — CLIENT REGISTER",
        subtitle: `Period: ${label} · Exported by ${session.email}`,
        lines,
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
      prisma.user.count({ where: { role: "CLIENT", deletedAt: null, ...dateFilter } }),
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

    const lines: string[] = [];
    lines.push(`OVERVIEW STATEMENT — ${label}`);
    lines.push(`Total clients (joined)  : ${clientCount}`);
    lines.push(`Reservations listed     : ${reservations.length}`);
    lines.push(`Payments listed         : ${payments.length}`);
    lines.push(`Project deals listed    : ${deals.length}`);
    lines.push("");
    lines.push("PAYMENT LEDGER");
    lines.push(col("DATE", "CLIENT / TYPE", "DEBIT", "CREDIT", "STATUS"));
    lines.push("-" .repeat(90));
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
    if (!payments.length) lines.push("(no payments in this period)");
    lines.push("-" .repeat(90));
    lines.push(`Approved payment volume : ${money(approvedTotal)}`);
    lines.push("");
    lines.push("RESERVATIONS");
    lines.push("-" .repeat(90));
    for (const r of reservations) {
      lines.push(
        `${r.createdAt.toISOString().slice(0, 10)}  ${r.user?.name || "?"}  | ${r.asset?.title || ""}  | ${r.status} | paid ${money((r as any).installmentPaid || 0)}`
      );
    }
    if (!reservations.length) lines.push("(none)");
    lines.push("");
    lines.push("PROJECT DEALS");
    lines.push("-" .repeat(90));
    for (const d of deals as any[]) {
      lines.push(
        `${d.createdAt.toISOString().slice(0, 10)}  ${d.client?.name || ""} ${d.client?.email || ""}  | ${d.title || ""}  | ${d.status || ""} | ${money(d.budget)}`
      );
    }
    if (!deals.length) lines.push("(none)");

    const pdf = buildTextPdf({
      title: "HAMA CONSTRUCTION — ADMIN OVERVIEW STATEMENT",
      subtitle: `Period: ${label} · Exported by ${session.email}`,
      lines,
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
