import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildTextPdf, money } from "@/lib/pdf";

export const dynamic = "force-dynamic";

/** Admin overview PDF: clients, active reservations, pending payments */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const type = new URL(req.url).searchParams.get("type") || "overview";

  if (type === "clients") {
    const users = await prisma.user.findMany({
      where: { role: "CLIENT", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        name: true,
        email: true,
        status: true,
        verificationStatus: true,
        createdAt: true,
        _count: { select: { reservations: true, payments: true } },
      },
    });
    const lines = users.map(
      (u) =>
        `${u.createdAt.toISOString().slice(0, 10)} | ${u.name} | ${u.email} | ${u.status}/${u.verificationStatus} | res ${u._count.reservations} pay ${u._count.payments}`
    );
    const pdf = buildTextPdf({
      title: "Hama Construction — Clients Report",
      subtitle: `Exported by ${session.email}`,
      lines: lines.length ? lines : ["(no clients)"],
    });
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hama-clients-${Date.now()}.pdf"`,
      },
    });
  }

  const [users, reservations, payments] = await Promise.all([
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED", "INSTALLMENT_PLAN", "PARTIALLY_PAID"] },
      },
      include: { asset: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.payment.findMany({
      where: { status: "PENDING" },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const lines: string[] = [];
  lines.push(`Total clients: ${users}`);
  lines.push(`Active reservations: ${reservations.length}`);
  lines.push(`Pending payments: ${payments.length}`);
  lines.push("");
  lines.push("=== ACTIVE RESERVATIONS ===");
  for (const r of reservations) {
    lines.push(
      `${r.createdAt.toISOString().slice(0, 10)} | ${r.user.name} | ${r.asset.title} | ${r.status} | ${money(r.totalAmount || r.deposit)}`
    );
  }
  lines.push("");
  lines.push("=== PENDING PAYMENTS ===");
  for (const p of payments) {
    lines.push(
      `${p.createdAt.toISOString().slice(0, 10)} | ${p.user.name} | ${p.type} | ${money(p.amount)} | ${p.status}`
    );
  }

  const pdf = buildTextPdf({
    title: "Hama Construction — Admin Overview",
    subtitle: `Exported by ${session.email}`,
    lines,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="hama-admin-overview-${Date.now()}.pdf"`,
    },
  });
}
