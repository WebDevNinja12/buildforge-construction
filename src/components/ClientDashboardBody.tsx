"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Building2,
  CalendarClock,
  CreditCard,
  FileText,
  Layers,
  Wrench,
} from "lucide-react";
import { DashboardPlans } from "@/components/DashboardPlans";
import { ClientOtherBookings } from "@/components/ClientOtherBookings";
import { ClientDocumentsList } from "@/components/ClientDocumentsList";
import { ClientInstallmentDocUploads } from "@/components/ClientInstallmentDocUploads";
import { ClientContracts } from "@/components/ClientContracts";
import { ClientProjectDeal } from "@/components/ClientProjectDeal";
import { ClientHistoryActions } from "@/components/HistoryActions";
import { formatCurrency, formatDate, statusBadgeClass } from "@/lib/utils";

type Section = "overview" | "plans" | "documents" | "payments" | "contracts" | "deal";

function sectionFromHash(): Section {
  if (typeof window === "undefined") return "overview";
  const h = (window.location.hash || "").replace("#", "").toLowerCase();
  if (h === "plans" || h === "reservations") return "plans";
  if (h === "documents" || h === "docs") return "documents";
  if (h === "payments") return "payments";
  if (h === "contracts") return "contracts";
  if (h === "deal" || h === "project") return "deal";
  return "overview";
}

type Props = {
  firstName: string;
  verified: boolean;
  vStatus: string;
  verificationNote?: string | null;
  stats: {
    reservations: number;
    rentals: number;
    activePlans: number;
    documents: number;
  };
  payments: Array<{
    id: string;
    amount: number;
    type: string;
    status: string;
    createdAt: string | Date;
  }>;
  notifications: Array<{ id: string; title?: string; body?: string }>;
};

export function ClientDashboardBody({
  firstName,
  verified,
  vStatus,
  verificationNote,
  stats,
  payments,
  notifications,
}: Props) {
  const [section, setSection] = useState<Section>("overview");

  useEffect(() => {
    const sync = () => setSection(sectionFromHash());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function go(s: Section) {
    const hash =
      s === "overview"
        ? ""
        : s === "plans"
          ? "#plans"
          : s === "documents"
            ? "#documents"
            : s === "payments"
              ? "#payments"
              : s === "contracts"
                ? "#contracts"
                : "#deal";
    if (hash) {
      window.location.hash = hash;
    } else {
      history.replaceState(null, "", window.location.pathname);
      setSection("overview");
    }
    setSection(s);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-construction-dark via-slate-800 to-slate-900 text-white p-5 sm:p-7 shadow-lg border border-white/5">
        <p className="text-xs uppercase tracking-wider text-slate-300">Client portal</p>
        <h1 className="text-2xl sm:text-3xl font-bold mt-1">Hello, {firstName}</h1>
        <p className="text-sm text-slate-300 mt-1 max-w-xl">
          Overview of your account. Plans, documents, and payments live in their own sections.
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
          <button
            type="button"
            onClick={() => go("plans")}
            className="inline-flex items-center min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold"
          >
            View plans
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "Overview"],
            ["plans", "Plans"],
            ["documents", "Documents"],
            ["payments", "Payments"],
            ["contracts", "Contracts"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            className={`min-h-[40px] px-4 rounded-full text-sm font-semibold transition-colors ${
              section === id
                ? "bg-construction-dark text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-primary-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "overview" && (
        <>
          <div
            className={`rounded-2xl border px-4 sm:px-5 py-4 flex gap-3 ${
              verified ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
            }`}
          >
            <BadgeCheck
              className={`w-6 h-6 shrink-0 ${verified ? "text-green-600" : "text-amber-600"}`}
            />
            <div className="min-w-0">
              <p className="font-semibold text-sm sm:text-base">
                Verification:{" "}
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(vStatus)}`}
                >
                  {vStatus.replace(/_/g, " ")}
                </span>
              </p>
              <p className="text-sm text-slate-600 mt-1">
                {verified
                  ? "Your account is fully verified."
                  : "Under review — you can still reserve while we check your details."}
              </p>
              {verificationNote ? (
                <p className="text-xs text-slate-500 mt-1">{verificationNote}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Active reservations",
                value: stats.reservations,
                icon: CalendarClock,
                action: () => go("plans"),
                hint: "Open plans",
              },
              {
                label: "Active plans",
                value: stats.activePlans,
                icon: Layers,
                action: () => go("plans"),
                hint: "Installment schedules",
              },
              {
                label: "Documents",
                value: stats.documents,
                icon: FileText,
                action: () => go("documents"),
                hint: "ID & installment files",
              },
              {
                label: "Tool rentals",
                value: stats.rentals,
                icon: Building2,
                action: () => go("plans"),
                hint: "Equipment hire",
              },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={c.action}
                  className="text-left bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary-200 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500 font-medium">{c.label}</p>
                    <Icon className="w-4 h-4 text-primary-600" />
                  </div>
                  <p className="text-2xl font-bold text-construction-dark mt-1">{c.value}</p>
                  <p className="text-[11px] text-primary-700 font-medium mt-1">{c.hint} →</p>
                </button>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-construction-dark flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary-600" /> Recent payments
                </h2>
                <button
                  type="button"
                  onClick={() => go("payments")}
                  className="text-xs font-semibold text-primary-700"
                >
                  View all
                </button>
              </div>
              {payments.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No payments yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {payments.slice(0, 4).map((p) => (
                    <li key={p.id} className="py-2.5 flex justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-slate-500">
                          {p.type} · {formatDate(p.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-1 rounded-full h-fit ${statusBadgeClass(
                          p.status
                        )}`}
                      >
                        {p.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-construction-dark flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-primary-600" /> Notifications
              </h2>
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No new notifications.</p>
              ) : (
                <ul className="space-y-2">
                  {notifications.slice(0, 4).map((n) => (
                    <li key={n.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <p className="font-medium text-construction-dark">{n.title}</p>
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">{n.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => go("plans")}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-primary-300 shadow-sm"
            >
              <Layers className="w-5 h-5 text-primary-600 mb-2" />
              <p className="font-semibold text-sm text-construction-dark">Installment plans</p>
              <p className="text-xs text-slate-500 mt-1">Active schedules, balances, and next due dates</p>
            </button>
            <button
              type="button"
              onClick={() => go("documents")}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-primary-300 shadow-sm"
            >
              <FileText className="w-5 h-5 text-primary-600 mb-2" />
              <p className="font-semibold text-sm text-construction-dark">Documents</p>
              <p className="text-xs text-slate-500 mt-1">Upload installment files and view submitted docs</p>
            </button>
            <button
              type="button"
              onClick={() => go("deal")}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-primary-300 shadow-sm"
            >
              <Wrench className="w-5 h-5 text-primary-600 mb-2" />
              <p className="font-semibold text-sm text-construction-dark">Project deal</p>
              <p className="text-xs text-slate-500 mt-1">Custom construction project terms</p>
            </button>
          </div>
        </>
      )}

      {section === "plans" && (
        <div id="plans" className="scroll-mt-24 space-y-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-construction-dark">Plans & reservations</h2>
              <p className="text-xs text-slate-500">
                Asset/installment plans, tool rentals, and worker hires — pay and manage here.
              </p>
            </div>
            <ClientHistoryActions />
          </div>
          <DashboardPlans />
          <ClientOtherBookings />
        </div>
      )}

      {section === "documents" && (
        <div id="documents" className="scroll-mt-24 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-construction-dark">My documents</h2>
            <p className="text-xs text-slate-500">
              Upload installment documents here (required before first installment payment). Submitted
              files are listed below.
            </p>
          </div>
          <ClientInstallmentDocUploads />
          <ClientDocumentsList />
        </div>
      )}

      {section === "payments" && (
        <div id="payments" className="scroll-mt-24 space-y-3">
          <h2 className="text-lg font-bold text-construction-dark">Payment history</h2>
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
                      className={`text-[10px] font-semibold px-2 py-1 rounded-full h-fit ${statusBadgeClass(
                        p.status
                      )}`}
                    >
                      {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {section === "contracts" && (
        <div id="contracts" className="scroll-mt-24 space-y-3">
          <h2 className="text-lg font-bold text-construction-dark">My contracts</h2>
          <ClientContracts />
        </div>
      )}

      {section === "deal" && (
        <div id="deal" className="scroll-mt-24 space-y-3">
          <h2 className="text-lg font-bold text-construction-dark flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary-600" /> Project deal
          </h2>
          <ClientProjectDeal />
        </div>
      )}
    </div>
  );
}
