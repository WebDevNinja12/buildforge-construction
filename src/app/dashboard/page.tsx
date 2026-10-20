import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Building2,
  Wrench,
  Users,
  ClipboardList,
  CreditCard,
  ArrowRight,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [reservations, rentals, hires, projects, payments] = await Promise.all([
    prisma.reservation.findMany({
      where: { userId: session.id },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.toolRental.findMany({
      where: { userId: session.id },
      include: { tool: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.hireRequest.findMany({
      where: { userId: session.id },
      include: { worker: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.project.findMany({
      where: { OR: [{ clientId: session.id }, { managerId: session.id }] },
      include: { milestones: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.payment.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-construction-dark">Dashboard</h1>
            <p className="mt-1 text-construction-gray">Welcome back, {session.name}</p>
          </div>
          <Link
            href="/services"
            className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Browse Services <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Reservations", value: reservations.length, icon: Building2, color: "bg-primary-100 text-primary-600" },
            { label: "Tool Rentals", value: rentals.length, icon: Wrench, color: "bg-orange-100 text-orange-600" },
            { label: "Hire Requests", value: hires.length, icon: Users, color: "bg-green-100 text-green-600" },
            { label: "Projects", value: projects.length, icon: ClipboardList, color: "bg-purple-100 text-purple-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <p className="mt-3 text-2xl font-bold text-construction-dark">{s.value}</p>
              <p className="text-sm text-construction-gray">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-600" />
              <h2 className="font-semibold text-construction-dark">Reservations</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {reservations.length === 0 ? (
                <p className="p-5 text-sm text-construction-gray">No reservations yet.</p>
              ) : (
                reservations.map((r) => (
                  <div key={r.id} className="px-5 py-4 flex justify-between items-start gap-3">
                    <div>
                      <p className="font-medium text-construction-dark">{r.asset.title}</p>
                      <p className="text-sm text-slate-500">{r.asset.type} · Deposit {formatCurrency(r.deposit)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(r.createdAt)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      r.status === "CONFIRMED" ? "bg-green-100 text-green-700" :
                      r.status === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }`}>{r.status}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-accent-600" />
              <h2 className="font-semibold text-construction-dark">Tool Rentals</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {rentals.length === 0 ? (
                <p className="p-5 text-sm text-construction-gray">No rentals yet.</p>
              ) : (
                rentals.map((r) => (
                  <div key={r.id} className="px-5 py-4 flex justify-between items-start gap-3">
                    <div>
                      <p className="font-medium text-construction-dark">{r.tool.name}</p>
                      <p className="text-sm text-slate-500">{formatDate(r.startDate)} → {formatDate(r.endDate)} · {formatCurrency(r.totalCost)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      r.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                      r.status === "RETURNED" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"
                    }`}>{r.status}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-construction-dark">Hire Requests</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {hires.length === 0 ? (
                <p className="p-5 text-sm text-construction-gray">No hire requests yet.</p>
              ) : (
                hires.map((h) => (
                  <div key={h.id} className="px-5 py-4 flex justify-between items-start gap-3">
                    <div>
                      <p className="font-medium text-construction-dark line-clamp-1">{h.description}</p>
                      <p className="text-sm text-slate-500">{h.worker?.name || h.serviceType} · {h.location}</p>
                      <p className="text-xs text-slate-400">Start: {formatDate(h.startDate)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      h.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                      h.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                    }`}>{h.status}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-construction-dark">Projects</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {projects.length === 0 ? (
                <p className="p-5 text-sm text-construction-gray">No projects yet.</p>
              ) : (
                projects.map((p) => (
                  <div key={p.id} className="px-5 py-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-medium text-construction-dark">{p.title}</p>
                        <p className="text-sm text-slate-500">Budget {formatCurrency(p.budget)} · Spent {formatCurrency(p.spent)}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        p.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                        p.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                      }`}>{p.status}</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Progress</span><span>{p.progress}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${p.progress}%` }} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-600" />
            <h2 className="font-semibold text-construction-dark">Recent Payments</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-6 text-center text-construction-gray">No payments yet.</td></tr>
                ) : (
                  payments.map((pay) => (
                    <tr key={pay.id}>
                      <td className="px-5 py-3 font-medium text-construction-dark">{pay.type}</td>
                      <td className="px-5 py-3">{formatCurrency(pay.amount)}</td>
                      <td className="px-5 py-3 text-slate-500">{pay.method}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          pay.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                          pay.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        }`}>{pay.status}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{formatDate(pay.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
