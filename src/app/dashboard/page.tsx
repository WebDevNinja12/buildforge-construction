import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { runMaintenance } from "@/lib/maintenance";
import { DashboardPlans } from "@/components/DashboardPlans";
import { ClientHistoryActions, AdminExportButtons } from "@/components/HistoryActions";
import { ClientProjectDeal } from "@/components/ClientProjectDeal";
import { DashboardNav } from "@/components/DashboardNav";
import {
  Building2, Wrench, Users, ClipboardList, CreditCard, BadgeCheck,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && !["APPROVED", "UNDER_REVIEW", "VERIFIED"].includes(session.status || "")) {
    redirect("/pending-approval");
  }

  await runMaintenance().catch(() => null);

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { status: true, verificationStatus: true, verificationNote: true },
  });

  const [reservations, rentals, hires, projects, payments, notifications] = await Promise.all([
    prisma.reservation.count({ where: { userId: session.id } }),
    prisma.toolRental.count({ where: { userId: session.id } }),
    prisma.hireRequest.count({ where: { userId: session.id } }),
    prisma.project.count({ where: { OR: [{ clientId: session.id }, { managerId: session.id }] } }),
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
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-construction-dark">Dashboard</h1>
          <p className="mt-1 text-construction-gray">Welcome back, {session.name}</p>
        </div>

        <DashboardNav role={session.role} />

        <div className="mb-6 flex flex-wrap gap-3">
          {session.role !== "ADMIN" && <ClientHistoryActions />}
          {session.role === "ADMIN" && <AdminExportButtons />}
        </div>

        <div
          className={`mb-8 rounded-xl border px-5 py-4 flex gap-3 ${
            vStatus === "VERIFIED" ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
          }`}
        >
          <BadgeCheck
            className={`w-6 h-6 shrink-0 ${vStatus === "VERIFIED" ? "text-green-600" : "text-amber-600"}`}
          />
          <div>
            <p className="font-semibold">Verification: {vStatus.replace(/_/g, " ")}</p>
            <p className="text-sm text-slate-600">
              {vStatus === "VERIFIED" ? "Fully verified." : "Under review or pending documents."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Reservations", value: reservations, icon: Building2, color: "bg-primary-100 text-primary-600" },
            { label: "Tool Rentals", value: rentals, icon: Wrench, color: "bg-orange-100 text-orange-600" },
            { label: "Hire Requests", value: hires, icon: Users, color: "bg-green-100 text-green-600" },
            { label: "Project deals", value: projects, icon: ClipboardList, color: "bg-purple-100 text-purple-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-5 border shadow-sm">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <p className="mt-3 text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-construction-gray">{s.label}</p>
            </div>
          ))}
        </div>

        <section className="mb-10">
          <h2 className="text-xl font-bold text-construction-dark mb-4">Your plans & reservations</h2>
          <DashboardPlans />
        </section>

        {session.role !== "ADMIN" && (
          <section className="mb-10">
            <h2 className="text-xl font-bold text-construction-dark mb-2">Construction project deals</h2>
            <p className="text-sm text-slate-500 mb-4">
              Open a deal for your build. Admin reviews it. If accepted, Hama contacts you using your profile details.
            </p>
            <ClientProjectDeal />
          </section>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <section className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b font-semibold flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-600" /> Notifications
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-5 text-sm text-slate-500">No notifications.</p>
              ) : (
                notifications.map((n: any) => (
                  <div key={n.id} className="px-5 py-3">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.body}</p>
                    <p className="text-[10px] text-slate-400">{formatDate(n.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b font-semibold flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Payment history
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        No payments yet.
                      </td>
                    </tr>
                  ) : (
                    payments.map((pay) => (
                      <tr key={pay.id}>
                        <td className="px-4 py-2">{pay.type}</td>
                        <td className="px-4 py-2">{formatCurrency(pay.amount)}</td>
                        <td className="px-4 py-2">{pay.status}</td>
                        <td className="px-4 py-2 text-slate-500">{formatDate(pay.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
