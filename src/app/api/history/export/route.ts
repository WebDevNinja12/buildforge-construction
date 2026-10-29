import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { buildTextPdf, money } from "@/lib/pdf";

export const dynamic = "force-dynamic";

/** Client or admin downloads a PDF summary. Admin: ?userId= optional */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    select: { id: true, name: true, email: true, phone: true, status: true, verificationStatus: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [reservations, rentals, hires, payments] = await Promise.all([
    prisma.reservation.findMany({
      where: { userId },
      include: { asset: true, installments: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.toolRental.findMany({
      where: { userId },
      include: { tool: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.hireRequest.findMany({
      where: { userId },
      include: { worker: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const lines: string[] = [];
  lines.push(`Client: ${user.name}`);
  lines.push(`Email: ${user.email}  Phone: ${user.phone || "-"}`);
  lines.push(`Status: ${user.status} / ${user.verificationStatus}`);
  lines.push("");
  lines.push("=== RESERVATIONS ===");
  if (!reservations.length) lines.push("(none)");
  for (const r of reservations) {
    lines.push(
      `${r.createdAt.toISOString().slice(0, 10)} | ${r.asset.title} | ${r.status} | ${r.paymentMethod} | total ${money(r.totalAmount || r.deposit)} paid ${money(r.amountPaid)}`
    );
  }
  lines.push("");
  lines.push("=== TOOL RENTALS ===");
  if (!rentals.length) lines.push("(none)");
  for (const t of rentals) {
    lines.push(
      `${t.createdAt.toISOString().slice(0, 10)} | ${t.tool.name} | ${t.status} | ${money(t.totalCost)}`
    );
  }
  lines.push("");
  lines.push("=== HIRE REQUESTS ===");
  if (!hires.length) lines.push("(none)");
  for (const h of hires) {
    lines.push(
      `${h.createdAt.toISOString().slice(0, 10)} | ${h.worker?.name || h.serviceType} | ${h.status} | ${money(h.estimatedCost || 0)}`
    );
  }
  lines.push("");
  lines.push("=== PAYMENTS ===");
  if (!payments.length) lines.push("(none)");
  for (const p of payments) {
    lines.push(
      `${p.createdAt.toISOString().slice(0, 10)} | ${p.type} | ${money(p.amount)} | ${p.status} | ${p.method}`
    );
  }
  lines.push("");
  lines.push("Hama Construction — Building innovation through quality and trust.");

  const pdf = buildTextPdf({
    title: "Hama Construction — Account History",
    subtitle: session.role === "ADMIN" ? `Admin export for ${user.email}` : "Client download",
    lines,
  });

  const filename = `hama-history-${user.email.replace(/[^a-z0-9]/gi, "_")}-${Date.now()}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
