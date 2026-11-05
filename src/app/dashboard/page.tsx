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
import { ArrowRight, BadgeCheck, Bell, Wrench } from "lucide-react";

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

  const [reservations, rentals, activePlans, payments, notifications] = await Promise.all([
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
      <div className="mb-6 rounded-3xl bg-gradient-to-br from-construction-dark via-slate-800 to-slate-900 text-white p-5 sm:p-7 shadow-lg border border-white/5">
        <p className="text-xs uppercase tracking-wider text-slate-300">Client dashboard</p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">
          Hello, {session.name.split(" ")[0]}
        </h1>
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
            href: "#reservations",
            hint: "Holds waiting for payment",
          },
          {
            label: "Tool rentals",
            value: rentals,
            href: "#reservations",
            hint: "Equipment you hired",
          },
          {
            label: "Installment plans",
            value: activePlans,
            href: "#reservations",
            hint: "Active payment schedules",
          },
        ].map((c) => (
          <a
            key={c.label}
            href={c.href}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-xs text-slate-500 font-medium">{c.label}</p>
            <p className="text-2xl font-bold text-construction-dark mt-1">{c.value}</p>
            <p className="text-[11px] text-slate-400 mt-1">{c.hint}</p>
          </a>
        ))}
      </div>

      <div id="reservations" className="scroll-mt-24 mb-10">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-bold text-construction-dark">Plans & reservations</h2>
          <ClientHistoryActions />
        </div>
        <DashboardPlans />
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-construction-dark mb-3">My documents</h2>
        <ClientDocumentsList />
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-construction-dark mb-3">My contracts</h2>
        <ClientContracts />
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-construction-dark mb-3 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-primary-600" /> Project deal
        </h2>
        <ClientProjectDeal />
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-bold text-construction-dark mb-3">Payment history</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {payments.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No payments yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="px-4 py-3 flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-slate-500">
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
