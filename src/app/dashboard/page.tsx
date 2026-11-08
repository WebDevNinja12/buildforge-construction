import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runMaintenance } from "@/lib/maintenance";
import { ClientShell } from "@/components/ClientShell";
import { ClientDashboardBody } from "@/components/ClientDashboardBody";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");
  if (session.role === "ADMIN") redirect("/admin");

  await runMaintenance().catch(() => null);

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      verificationStatus: true,
      verificationNote: true,
      status: true,
    },
  });

  const [reservations, rentals, activePlans, docCount, payments, notifications] =
    await Promise.all([
      prisma.reservation.count({
        where: { userId: session.id, status: { in: ["PENDING", "CONFIRMED"] } },
      }),
      prisma.toolRental.count({ where: { userId: session.id } }).catch(() => 0),
      prisma.reservation.count({
        where: {
          userId: session.id,
          paymentType: "INSTALLMENT",
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      }),
      prisma.installmentDocument
        .count({ where: { userId: session.id } })
        .catch(() => 0),
      prisma.payment.findMany({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification
        .findMany({
          where: { userId: session.id },
          orderBy: { createdAt: "desc" },
          take: 6,
        })
        .catch(() => [] as any[]),
    ]);

  let documents = docCount;
  try {
    const reg = await prisma.userDocument.count({ where: { userId: session.id } });
    documents = docCount + reg;
  } catch {
    /* */
  }

  const vStatus = user?.verificationStatus || "PENDING";
  const verified = vStatus === "VERIFIED";
  const firstName = (session.name || "Client").split(" ")[0];

  return (
    <ClientShell name={session.name}>
      <ClientDashboardBody
        firstName={firstName}
        verified={verified}
        vStatus={vStatus}
        verificationNote={user?.verificationNote}
        stats={{
          reservations,
          rentals,
          activePlans,
          documents,
        }}
        payments={payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          type: p.type,
          status: p.status,
          createdAt: p.createdAt,
        }))}
        notifications={notifications.map((n: any) => ({
          id: n.id,
          title: n.title,
          body: n.body,
        }))}
      />
    </ClientShell>
  );
}
