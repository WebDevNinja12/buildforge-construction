import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Period = "monthly" | "quarterly" | "annual";

function parsePeriod(raw: string | null): Period {
  const p = String(raw || "monthly").toLowerCase();
  if (p === "quarterly" || p === "quarter") return "quarterly";
  if (p === "annual" || p === "yearly" || p === "year") return "annual";
  return "monthly";
}

function buildBuckets(period: Period, year: number): { key: string; label: string; start: Date; end: Date }[] {
  const buckets: { key: string; label: string; start: Date; end: Date }[] = [];
  if (period === "monthly") {
    for (let m = 0; m < 12; m++) {
      const start = new Date(year, m, 1, 0, 0, 0, 0);
      const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
      buckets.push({
        key: `${year}-${String(m + 1).padStart(2, "0")}`,
        label: start.toLocaleString("en-US", { month: "short" }),
        start,
        end,
      });
    }
  } else if (period === "quarterly") {
    const labels = ["Q1", "Q2", "Q3", "Q4"];
    for (let q = 0; q < 4; q++) {
      const start = new Date(year, q * 3, 1, 0, 0, 0, 0);
      const end = new Date(year, q * 3 + 3, 0, 23, 59, 59, 999);
      buckets.push({
        key: `${year}-Q${q + 1}`,
        label: labels[q],
        start,
        end,
      });
    }
  } else {
    for (let y = year - 4; y <= year; y++) {
      const start = new Date(y, 0, 1, 0, 0, 0, 0);
      const end = new Date(y, 11, 31, 23, 59, 59, 999);
      buckets.push({
        key: String(y),
        label: String(y),
        start,
        end,
      });
    }
  }
  return buckets;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  try {
    const sp = new URL(req.url).searchParams;
    const period = parsePeriod(sp.get("period"));
    const year = Math.min(
      2100,
      Math.max(2020, Number(sp.get("year")) || new Date().getFullYear())
    );

    const buckets = buildBuckets(period, year);
    const rangeStart = buckets[0].start;
    const rangeEnd = buckets[buckets.length - 1].end;

    const [payments, reservations, newClients] = await Promise.all([
      prisma.payment.findMany({
        where: {
          createdAt: { gte: rangeStart, lte: rangeEnd },
          status: { in: ["APPROVED", "COMPLETED", "CONFIRMED", "PENDING"] },
        },
        select: { amount: true, status: true, createdAt: true },
        take: 5000,
      }),
      prisma.reservation.findMany({
        where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
        select: { status: true, createdAt: true, installmentTotal: true, installmentPaid: true },
        take: 5000,
      }),
      prisma.user.findMany({
        where: {
          role: "CLIENT",
          deletedAt: null,
          createdAt: { gte: rangeStart, lte: rangeEnd },
        },
        select: { createdAt: true },
        take: 5000,
      }),
    ]);

    const series = buckets.map((b) => {
      const pays = payments.filter((p) => p.createdAt >= b.start && p.createdAt <= b.end);
      const approved = pays.filter((p) =>
        ["APPROVED", "COMPLETED", "CONFIRMED"].includes(String(p.status))
      );
      const pending = pays.filter((p) => p.status === "PENDING");
      const revs = reservations.filter((r) => r.createdAt >= b.start && r.createdAt <= b.end);
      const clients = newClients.filter((u) => u.createdAt >= b.start && u.createdAt <= b.end);
      const revenue = approved.reduce((s, p) => s + Number(p.amount || 0), 0);
      return {
        key: b.key,
        label: b.label,
        revenue,
        paymentsApproved: approved.length,
        paymentsPending: pending.length,
        reservations: revs.length,
        newClients: clients.length,
      };
    });

    const totals = {
      revenue: series.reduce((s, x) => s + x.revenue, 0),
      paymentsApproved: series.reduce((s, x) => s + x.paymentsApproved, 0),
      paymentsPending: series.reduce((s, x) => s + x.paymentsPending, 0),
      reservations: series.reduce((s, x) => s + x.reservations, 0),
      newClients: series.reduce((s, x) => s + x.newClients, 0),
    };

    return NextResponse.json({
      period,
      year,
      series,
      totals,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("reports stats", e);
    return NextResponse.json(
      { error: "Failed to load report stats", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
