import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { runMaintenance } from "@/lib/maintenance";
import { DashboardPlans } from "@/components/DashboardPlans";
import { ClientHistoryActions } from "@/components/HistoryActions";
import { ClientProjectDeal } from "@/components/ClientProjectDeal";
import { ClientShell } from "@/components/ClientShell";
import {
  Building2,
  Wrench,
  Layers,
  BadgeCheck,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");

  if (!["APPROVED", "UNDER_REVIEW", "VERIFIED"].includes(session.status || "")) {
    redirect("/pending-approval");
  }

  await runMaintenance().catch(() => null);

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { status: true, verificationStatus: true, verificationNote: true },
  });

  const [reservations, rentals, activePlans, payments, notifications] = await Promise.all([
    prisma.reservation.count({
      where: {
        userId: session.id,
        status: { in: ["PENDING", "CONFIRMED", "PARTIALLY_PAID", "INSTALLMENT_PLAN"] },
      },
    }),
    prisma.toolRental.count({
      where: { userId: session.id, status: { in: ["PENDING", "ACTIVE", "CONFIRMED"] } },
    }),
    prisma.reservation.count({
      where: {
        userId: session.id,
        paymentType: "INSTALLMENT",
        status: { in: ["PENDING", "CONFIRMED", "PARTIALLY_PAID", "INSTALLMENT_PLAN"] },
      },
    }),
    prisma.payment.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.notification
      .findMany({
        where: { userId: session.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
      .catch(() => [] as any[]),
  ]);

  const vStatus = user?.verificationStatus || "PENDING";

  return (
    <ClientShell name={session.name}>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-construction-dark">Dashboard</h1>
        <p className="mt-1 text-construction-gray text-sm sm:text-base">Welcome back, {session.name}</p>
      </div>

      <div
        className={`mb-6 rounded-2xl border px-4 sm:px-5 py-4 flex gap-3 ${
          vStatus === "VERIFIED"
            ? "bg-green-50 border-green-200"
            : "bg-amber-50 border-amber-200"
        }`}
      >
        <BadgeCheck
          className={`w-6 h-6 shrink-0 ${
            vStatus === "VERIFIED" ? "text-green-600" : "text-amber-600"
          }`}
        />
        <div>
          <p className="font-semibold text-sm sm:text-base">
            Verification: {vStatus.replace(/_/g, " ")}
          </p>
          <p className="text-sm text-slate-600">
            {vStatus === "VERIFIED"
              ? "Your account is fully verified."
              : "Under review — you can still use the portal while documents are checked."}
          </p>
          {user?.verificationNote && (
            <p className="text-xs text-slate-500 mt-1">{user.verificationNote}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          {
            label: "My Reservations",
            value: reservations,
            icon: Building2,
            color: "bg-primary-100 text-primary-600",
            href: "#reservations",
          },
          {
            label: "Tool Rentals",
            value: rentals,
            icon: Wrench,
            color: "bg-orange-100 text-orange-600",
            href: "#reservations",
          },
          {
            label: "Active Installment Plans",
            value: activePlans,
            icon: Layers,
            color: "bg-accent-100 text-accent-700",
            href: "#plans",
          },
        ].map((s) => (
          <a
            key={s.label}
            href={s.href}
            className="bg-white rounded-2xl p-5 border shadow-sm hover:border-primary-200 transition-colors"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="mt-3 text-2xl font-bold text-construction-dark">{s.value}</p>
            <p className="text-sm text-construction-gray">{s.label}</p>
          </a>
        ))}
      </div>

      <div className="mb-4 flex justify-end">
        <ClientHistoryActions />
      </div>

      <section id="plans" className="mb-10 scroll-mt-20">
        <h2 className="text-xl font-bold text-construction-dark mb-4">
          Your plans & reservations
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Live countdowns, Pay Now and Pay Remaining Balance are available on each active plan card.
        </p>
        <div id="reservations" className="scroll-mt-20">
          <DashboardPlans />
        </div>
      </section>

      <section id="documents" className="mb-10 scroll-mt-20">
        <h2 className="text-xl font-bold text-construction-dark mb-2">My documents</h2>
        <p className="text-sm text-slate-500 mb-3">
          Installment document uploads appear on each installment plan card after you choose installment payment.
        </p>
      </section>

      <section className="mb-10">
        <ClientProjectDeal />
      </section>

      <section id="payments" className="mb-10 scroll-mt-20">
        <h2 className="text-xl font-bold text-construction-dark mb-4">Payment history</h2>
        <div className="bg-white rounded-2xl border overflow-hidden">
          {payments.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-3">{formatDate(p.createdAt)}</td>
                      <td className="px-4 py-3">{p.type}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {notifications.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xl font-bold text-construction-dark mb-4">Notifications</h2>
          <ul className="space-y-2">
            {notifications.map((n: any) => (
              <li key={n.id} className="bg-white border rounded-xl px-4 py-3 text-sm">
                <p className="font-medium">{n.title}</p>
                <p className="text-slate-500 text-xs mt-0.5">{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </ClientShell>
  );
}
