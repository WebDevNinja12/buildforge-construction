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
  Briefcase,
  LayoutDashboard,
} from "lucide-react";
import { DashboardPlans } from "@/components/DashboardPlans";
import { ClientOtherBookings } from "@/components/ClientOtherBookings";
import { ClientDocumentsList } from "@/components/ClientDocumentsList";
import { ClientInstallmentDocUploads } from "@/components/ClientInstallmentDocUploads";
import { ClientContracts } from "@/components/ClientContracts";
import { ClientProjectDeal } from "@/components/ClientProjectDeal";
import { ClientHistoryActions } from "@/components/HistoryActions";
import { formatCurrency, formatDate, statusBadgeClass } from "@/lib/utils";

type Section =
  | "overview"
  | "reservations"
  | "plans"
  | "documents"
  | "payments"
  | "contracts"
  | "deal";

function sectionFromHash(): Section {
  if (typeof window === "undefined") return "overview";
  const h = (window.location.hash || "").replace("#", "").toLowerCase();
  if (h === "reservations" || h === "reservation") return "reservations";
  if (h === "plans" || h === "installments" || h === "installment") return "plans";
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

const TABS: { id: Section; label: string; icon: typeof Layers }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "reservations", label: "Reservations", icon: CalendarClock },
  { id: "plans", label: "Installments", icon: Layers },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "contracts", label: "Contracts", icon: FileText },
  { id: "deal", label: "Project deal", icon: Briefcase },
];

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
        : s === "reservations"
          ? "#reservations"
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
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 opacity-[0.97]" />
        <div className="relative px-5 sm:px-7 py-6 sm:py-8 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            Client portal
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            Hello, {firstName}
          </h1>
          <p className="text-sm text-slate-300 mt-2 max-w-xl leading-relaxed">
            Manage reservations, installment plans, documents, and payments in one place.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/services"
              className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-accent-500 hover:bg-accent-600 text-sm font-semibold text-white shadow-sm transition"
            >
              Browse services <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/quote"
              className="inline-flex items-center min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-semibold transition"
            >
              Request a quote
            </Link>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = section === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              className={`shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                on
                  ? "bg-construction-dark text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${on ? "text-white/90" : "text-slate-400"}`} />
              {label}
            </button>
          );
        })}
      </div>

      {section === "overview" && (
        <>
          <div
            className={`rounded-2xl border px-4 sm:px-5 py-4 flex gap-3 ${
              verified
                ? "bg-emerald-50/80 border-emerald-200"
                : "bg-amber-50/80 border-amber-200"
            }`}
          >
            <span
              className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              <BadgeCheck className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-construction-dark flex flex-wrap items-center gap-2">
                Account verification
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusBadgeClass(vStatus)}`}
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
                action: () => go("reservations"),
                hint: "Open list",
              },
              {
                label: "Installment plans",
                value: stats.activePlans,
                icon: Layers,
                action: () => go("plans"),
                hint: "Schedules",
              },
              {
                label: "Documents",
                value: stats.documents,
                icon: FileText,
                action: () => go("documents"),
                hint: "Files",
              },
              {
                label: "Tool rentals",
                value: stats.rentals,
                icon: Building2,
                action: () => go("reservations"),
                hint: "Equipment",
              },
            ].map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={c.action}
                  className="text-left bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary-200 transition group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 inline-flex items-center justify-center group-hover:bg-primary-100 transition">
                      <Icon className="w-4 h-4" />
                    </span>
                    <p className="text-[11px] text-primary-700 font-semibold opacity-0 group-hover:opacity-100 transition">
                      {c.hint} →
                    </p>
                  </div>
                  <p className="text-2xl font-bold text-construction-dark mt-3 tabular-nums">
                    {c.value}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{c.label}</p>
                </button>
              );
            })}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-construction-dark flex items-center gap-2 text-sm sm:text-base">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 text-primary-700 inline-flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </span>
                  Recent payments
                </h2>
                <button
                  type="button"
                  onClick={() => go("payments")}
                  className="text-xs font-semibold text-primary-700 hover:underline"
                >
                  View all
                </button>
              </div>
              {payments.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No payments yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {payments.slice(0, 5).map((p) => (
                    <li
                      key={p.id}
                      className="py-3 flex justify-between gap-3 text-sm first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-construction-dark">
                          {formatCurrency(p.amount)}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {p.type} · {formatDate(p.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full h-fit shrink-0 ${statusBadgeClass(
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

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-construction-dark flex items-center gap-2 text-sm sm:text-base">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 text-primary-700 inline-flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </span>
                  Notifications
                </h2>
              </div>
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No notifications yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {notifications.slice(0, 6).map((n) => (
                    <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                      <p className="text-sm font-medium text-construction-dark">
                        {n.title || "Update"}
                      </p>
                      {n.body && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {[
              {
                href: "/services",
                title: "Browse services",
                body: "Houses, land, hotels, tools & workers",
                icon: Building2,
              },
              {
                href: "/quote",
                title: "Request a quote",
                body: "Get a project estimate from our team",
                icon: FileText,
              },
              {
                id: "deal" as Section,
                title: "Open a project deal",
                body: "Submit a construction deal for review",
                icon: Wrench,
              },
            ].map((item) => {
              const Icon = item.icon;
              const inner = (
                <>
                  <span className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 inline-flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-construction-dark">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.body}</p>
                  </div>
                </>
              );
              if ("href" in item && item.href) {
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="flex gap-3 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:border-primary-200 hover:shadow-md transition"
                  >
                    {inner}
                  </Link>
                );
              }
              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => go(item.id!)}
                  className="flex gap-3 text-left bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:border-primary-200 hover:shadow-md transition"
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </>
      )}

      {section === "reservations" && (
        <div id="reservations" className="scroll-mt-24 space-y-4">
          <SectionHead
            title="My reservations"
            subtitle="Active holds and bookings. Installment schedules are under Installments."
          />
          <ClientHistoryActions />
          <DashboardPlans mode="reservations" />
          <ClientOtherBookings />
        </div>
      )}

      {section === "plans" && (
        <div id="plans" className="scroll-mt-24 space-y-4">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <SectionHead
              title="Installment plans"
              subtitle="Balances, next due dates, and installment payments — separate from reservation holds."
            />
            <ClientHistoryActions />
          </div>
          <DashboardPlans mode="installments" />
        </div>
      )}

      {section === "documents" && (
        <div id="documents" className="scroll-mt-24 space-y-4">
          <SectionHead
            title="My documents"
            subtitle="Upload installment documents here (required before first installment payment)."
          />
          <ClientInstallmentDocUploads />
          <ClientDocumentsList />
        </div>
      )}

      {section === "payments" && (
        <div id="payments" className="scroll-mt-24 space-y-4">
          <SectionHead title="Payment history" subtitle="All reservation and installment payments." />
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm">
            {payments.length === 0 ? (
              <p className="p-8 text-sm text-slate-500 text-center">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="px-4 sm:px-5 py-3.5 flex justify-between gap-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-construction-dark">
                        {formatCurrency(p.amount)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {p.type} · {formatDate(p.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full h-fit ${statusBadgeClass(
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
        <div id="contracts" className="scroll-mt-24 space-y-4">
          <SectionHead title="My contracts" subtitle="Issued agreements for approved services." />
          <ClientContracts />
        </div>
      )}

      {section === "deal" && (
        <div id="deal" className="scroll-mt-24 space-y-4">
          <SectionHead
            title="Project deal"
            subtitle="Open a construction deal for admin review. Accepted deals are followed up offline."
          />
          <ClientProjectDeal />
        </div>
      )}
    </div>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-construction-dark tracking-tight">{title}</h2>
      {subtitle && (
        <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}
