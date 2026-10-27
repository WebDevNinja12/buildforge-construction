import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import { runMaintenance } from "@/lib/maintenance";
import { Countdown } from "@/components/Countdown";
import {
  Building2, Wrench, Users, ClipboardList, CreditCard,
  ArrowRight, Shield, BadgeCheck, Clock,
} from "lucide-react";

function toIso(d: Date | string | null | undefined) {
  if (!d) return null;
  if (typeof d === "string") return d;
  return d.toISOString();
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN" && !["APPROVED", "UNDER_REVIEW", "VERIFIED"].includes(session.status || "")) {
    redirect("/pending-approval");
  }

  await runMaintenance().catch(() => null);

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      status: true,
      verificationStatus: true,
      verificationNote: true,
      verifiedAt: true,
      approvedAt: true,
    },
  });

  const [reservations, rentals, hires, projects, payments, notifications] = await Promise.all([
    prisma.reservation.findMany({
      where: { userId: session.id },
      include: { asset: true, installments: { orderBy: { sequence: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 20,
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
      take: 15,
    }),
    prisma.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }).catch(() => [] as any[]),
  ]);

  const vStatus = user?.verificationStatus || "PENDING";

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-construction-dark">Dashboard</h1>
            <p className="mt-1 text-construction-gray">Welcome back, {session.name}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {session.role === "ADMIN" && (
              <Link href="/admin" className="inline-flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white font-semibold px-5 py-2.5 rounded-xl">
                <Shield className="w-4 h-4" /> Admin Control
              </Link>
            )}
            <Link href="/services" className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold px-5 py-2.5 rounded-xl">
              Browse Services <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className={`mb-8 rounded-xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
          vStatus === "VERIFIED" ? "bg-green-50 border-green-200" :
          vStatus === "REJECTED" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
        }`}>
          <BadgeCheck className={`w-6 h-6 shrink-0 ${vStatus === "VERIFIED" ? "text-green-600" : "text-amber-600"}`} />
          <div className="flex-1">
            <p className="font-semibold text-construction-dark">
              Verification status: <span className="underline decoration-dotted">{vStatus.replace(/_/g, " ")}</span>
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              {vStatus === "VERIFIED"
                ? "Your profile is fully verified."
                : "Account may be usable while under review."}
            </p>
          </div>
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
              <Clock className="w-4 h-4 text-slate-400 ml-auto" />
            </div>
            <div className="divide-y divide-slate-100">
              {reservations.length === 0 ? (
                <p className="p-5 text-sm text-construction-gray">No reservations yet. Reserve from Services and choose Full or Installment payment.</p>
              ) : (
                reservations.map((r) => {
                  const nextInst = r.installments?.find((i) => i.status === "PENDING");
                  return (
                    <div key={r.id} className="px-5 py-4 flex justify-between items-start gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-construction-dark">{r.asset.title}</p>
                        <p className="text-sm text-slate-500">
                          {r.asset.type} · {" "}
                          <span className="font-medium text-primary-700">{r.paymentMethod || "FULL"}</span>
                          {" · Deposit "}{formatCurrency(r.deposit)}
                          {r.totalAmount ? ` · Total ${formatCurrency(r.totalAmount)}` : ""}
                        </p>
                        {r.amountPaid > 0 && (
                          <p className="text-xs text-green-700">
                            Paid {formatCurrency(r.amountPaid)}
                            {r.totalAmount ? ` · Balance ${formatCurrency(Math.max(0, r.totalAmount - r.amountPaid))}` : ""}
                          </p>
                        )}
                        {r.installments?.length > 0 && (
                          <p className="text-xs text-slate-500">
                            Installments: {r.installments.filter((i) => i.status === "PAID").length}/{r.installments.length} paid
                            {nextInst && <> · Next {formatCurrency(nextInst.amount)}</>}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {r.expiresAt && (
                            <Countdown
                              expiresAt={toIso(r.expiresAt)}
                              status={r.status}
                              label="Hold expires in"
                            />
                          )}
                          {r.planDeadline && ["INSTALLMENT_PLAN", "PARTIALLY_PAID", "PENDING"].includes(r.status) && (
                            <Countdown
                              expiresAt={toIso(r.planDeadline)}
                              status={r.status}
                              label="Plan ends in"
                            />
                          )}
                          {nextInst?.dueDate && (
                            <Countdown
                              expiresAt={toIso(nextInst.dueDate)}
                              status={nextInst.status === "OVERDUE" ? "EXPIRED" : r.status}
                              label="Next due in"
                            />
                          )}
                          {!r.expiresAt && (
                            <span className="text-xs text-slate-400">No expiry set</span>
                          )}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                        r.status === "CONFIRMED" || r.status === "FULLY_PAID" ? "bg-green-100 text-green-700" :
                        r.status === "EXPIRED" || r.status === "CANCELLED" || r.status === "REFUNDED" ? "bg-red-100 text-red-700" :
                        r.status === "INSTALLMENT_PLAN" || r.status === "PARTIALLY_PAID" ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>{r.status}</span>
                    </div>
                  );
                })
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
                    <div className="space-y-1">
                      <p className="font-medium text-construction-dark">{r.tool.name}</p>
                      <p className="text-sm text-slate-500">{formatDate(r.startDate)} → {formatDate(r.endDate)} · {formatCurrency(r.totalCost)}</p>
                      {r.expiresAt && (
                        <Countdown expiresAt={toIso(r.expiresAt)} status={r.status} label="Pay by" />
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      r.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
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
                    <div className="space-y-1">
                      <p className="font-medium text-construction-dark line-clamp-1">{h.description}</p>
                      <p className="text-sm text-slate-500">{h.worker?.name || h.serviceType} · {h.location}</p>
                      {h.expiresAt && (
                        <Countdown expiresAt={toIso(h.expiresAt)} status={h.status} label="Hold expires in" />
                      )}
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-100 text-amber-700">{h.status}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-construction-dark">Notifications</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-5 text-sm text-construction-gray">No notifications.</p>
              ) : (
                notifications.map((n: any) => (
                  <div key={n.id} className="px-5 py-3">
                    <p className="font-medium text-sm text-construction-dark">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatDate(n.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-slate-600" />
            <h2 className="font-semibold text-construction-dark">Payments</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Note</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-6 text-center text-construction-gray">No payments yet.</td></tr>
                ) : (
                  payments.map((pay) => (
                    <tr key={pay.id}>
                      <td className="px-5 py-3 font-medium">{pay.type}</td>
                      <td className="px-5 py-3">{formatCurrency(pay.amount)}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          pay.status === "APPROVED" || pay.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                          pay.status === "REJECTED" || pay.status === "FAILED" ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>{pay.status}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 max-w-[200px]">{pay.rejectReason || "—"}</td>
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
