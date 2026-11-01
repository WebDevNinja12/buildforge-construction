import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate, statusBadgeClass } from "@/lib/utils";
import { runMaintenance } from "@/lib/maintenance";
import { DashboardPlans } from "@/components/DashboardPlans";
import { ClientHistoryActions } from "@/components/HistoryActions";
import { ClientProjectDeal } from "@/components/ClientProjectDeal";
import { ClientShell } from "@/components/ClientShell";
import { ClientDocumentsList } from "@/components/ClientDocumentsList";
import { ClientContracts } from "@/components/ClientContracts";
import {
  Building2,
  Wrench,
  Layers,
  BadgeCheck,
  Bell,
  ArrowRight,
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
    select: { status: true, verificationStatus: true, verificationNote: true, name: true },
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
        take: 6,
      })
      .catch(() => [] as any[]),
  ]);

  const vStatus = user?.verificationStatus || "PENDING";
  const verified = vStatus === "VERIFIED";

  return (
    <ClientShell name={session.name}>
      <div className="mb-6 rounded-2xl bg-construction-dark text-white p-5 sm:p-6 shadow-md">
        <p className="text-xs uppercase tracking-wider text-slate-300">Client dashboard</p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">Hello, {session.name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-300 mt-1">
          Manage reservations, installments, and documents in one place.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/services"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-accent-500 hover:bg-accent-600 text-sm font-semibold text-white"
          >
            Browse services <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/quote"
            className="inline-flex items-center min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold"
          >
            Request a quote
          </Link>
        </div>
      </div>

      <div
        className={`mb-6 rounded-2xl border px-4 sm:px-5 py-4 flex gap-3 ${
          verified ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
        }`}
      >
        <BadgeCheck className={`w-6 h-6 shrink-0 ${verified ? "text-green-600" : "text-amber-600"}`} />
        <div className="min-w-0">
          <p className="font-semibold text-sm sm:text-base">
            Verification:{" "}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(vStatus)}`}>
              {vStatus.replace(/_/g, " ")}
            </span>
          </p>
          <p className="text-sm text-slate-600 mt-1">
            {verified
              ? "Your account is fully verified."
              : "Under review — you can still reserve and upload documents while we check your details."}
          </p>
          {user?.verificationNote ? (
            <p className="text-xs text-slate-500 mt-1">{user.verificationNote}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        {[
          {
            label: "Active reservations",
            value: reservations,
            icon: Building2,
            color: "bg-primary-100 text-primary-700",
            href: "#reservations",
          },
          {
            label: "Tool rentals",
            value: rentals,
            icon: Wrench,
            color: "bg-orange-100 text-orange-700",
            href: "#reservations",
          },
          {
            label: "Installment plans",
            value: activePlans,
            icon: Layers,
            color: "bg-amber-100 text-amber-800",
            href: "#plans",
          },
        ].map((s) => (
          <a
            key={s.label}
            href={s.href}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:border-primary-300 hover:shadow transition-all"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="mt-3 text-3xl font-bold text-construction-dark tabular-nums">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </a>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-lg font-bold text-construction-dark" id="plans">
          Plans & reservations
        </h2>
        <ClientHistoryActions />
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Reserve first on Services, then choose full or installment payment here.
      </p>
      <div id="reservations" className="scroll-mt-24 mb-10">
        <DashboardPlans />
      </div>

      <section id="documents" className="mb-10 scroll-mt-24">
        <h2 className="text-lg font-bold text-construction-dark mb-3">My documents</h2>
        <ClientDocumentsList />
      </section>

      <section id="contracts" className="mb-10 scroll-mt-24">
        <h2 className="text-lg font-bold text-construction-dark mb-3">My contracts</h2>
        <ClientContracts />
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-construction-dark mb-3">Start a project deal</h2>
        <ClientProjectDeal />
      </section>

      <section id="payments" className="mb-10 scroll-mt-24">
        <h2 className="text-lg font-bold text-construction-dark mb-3">Payment history</h2>
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {payments.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No payments yet.</p>
          ) : (
            <>
              <ul className="md:hidden divide-y">
                {payments.map((p) => (
                  <li key={p.id} className="px-4 py-3 flex justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{formatCurrency(p.amount)}</p>
                      <p className="text-[11px] text-slate-500">
                        {p.type} · {formatDate(p.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-1 rounded-full h-fit ${
                        statusBadgeClass(p.status)
                      }`}
                    >
                      {p.status}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block overflow-x-auto">
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
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(p.status)}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      {notifications.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-construction-dark mb-3 flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary-600" /> Notifications
          </h2>
          <ul className="space-y-2">
            {notifications.map((n: any) => (
              <li key={n.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm shadow-sm">
                <p className="font-medium text-construction-dark">{n.title}</p>
                <p className="text-slate-500 text-xs mt-0.5">{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </ClientShell>
  );
}
