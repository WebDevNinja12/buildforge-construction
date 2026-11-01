"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlanCard } from "@/components/PlanCard";
import { Loader2, Building2 } from "lucide-react";

const TERMINAL = ["CANCELLED", "EXPIRED", "FULLY_PAID", "COMPLETED", "REFUNDED"];

export function DashboardPlans() {
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
        setError("Please log in again to see your plans.");
        setPlans([]);
        return;
      }
      const data = await res.json().catch(() => []);
      setPlans(Array.isArray(data) ? data : []);
    } catch {
      setError("Could not load plans. Pull to refresh or try again.");
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
        <p className="text-xs text-slate-500">Loading your plans…</p>
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

  const visible = showAll ? plans : plans.filter((p) => !TERMINAL.includes(p?.status));

  if (!plans.length) {
    return (
      <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center">
        <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-construction-dark">No reservations yet</p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          Browse services, preview full details, then reserve. Payment options appear here after you reserve.
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {visible.length} shown · {plans.length} total
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
          No active plans. Cleared or completed items are hidden — use “Show all history”.
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
