"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlanCard } from "@/components/PlanCard";
import { Loader2, Building2 } from "lucide-react";

const TERMINAL = ["CANCELLED", "EXPIRED", "FULLY_PAID", "COMPLETED", "REFUNDED"];

type PlansMode = "all" | "reservations" | "installments";

function isInstallmentPlan(p: any) {
  const m = String(p?.paymentMethod || p?.paymentType || "").toUpperCase();
  return m === "INSTALLMENT";
}

export function DashboardPlans({ mode = "all" }: { mode?: PlansMode }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/reservations", { credentials: "include" });
      if (res.status === 401) {
        setError("Please log in again.");
        setPlans([]);
        return;
      }
      const data = await res.json().catch(() => []);
      setPlans(Array.isArray(data) ? data : []);
    } catch {
      setError("Could not load this section. Try again.");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
        <p className="text-xs text-slate-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-sm text-amber-900">
        {error}
        <button type="button" onClick={load} className="block mt-2 font-semibold underline">
          Retry
        </button>
      </div>
    );
  }

  const byMode =
    mode === "installments"
      ? plans.filter(isInstallmentPlan)
      : mode === "reservations"
        ? plans.filter((p) => !isInstallmentPlan(p))
        : plans;
  const visible = showAll
    ? byMode
    : byMode.filter((p) => !TERMINAL.includes(String(p?.status || "").toUpperCase()));

  if (!byMode.length) {
    return (
      <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center">
        <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-construction-dark">
          {mode === "installments"
            ? "No installment plans yet"
            : mode === "reservations"
              ? "No reservations yet"
              : "No bookings yet"}
        </p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          {mode === "installments"
            ? "When you choose an installment plan on a reservation, it appears here with schedule and balance."
            : "Browse services, preview full details, then reserve. Full payment and hold countdown appear here."}
        </p>
        <Link
          href="/services"
          className="inline-flex items-center justify-center mt-4 min-h-[44px] px-5 rounded-xl bg-primary-600 text-white text-sm font-semibold"
        >
          Browse services
        </Link>
      </div>
    );
  }

  const title =
    mode === "installments"
      ? "Installment plans"
      : mode === "reservations"
        ? "Reservations"
        : "Plans and reservations";
  const subtitle =
    mode === "installments"
      ? "Active installment schedules, balances, and next due dates."
      : mode === "reservations"
        ? "Holds awaiting full payment or payment method selection. Installment plans are listed separately."
        : "All asset bookings.";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-construction-dark">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {visible.length} shown · {byMode.length} in this section
        </p>
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs font-semibold text-primary-700 min-h-[40px] px-2"
        >
          {showAll ? "Hide completed / cancelled" : "Show all history"}
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border rounded-2xl p-5">
          No active items in this section. Cleared or completed items are hidden — use “Show all history”.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {visible.map((p) => (
            <PlanCard key={p.id} plan={p} onUpdated={load} />
          ))}
        </div>
      )}
    </div>
  );
}
