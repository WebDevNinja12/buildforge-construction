"use client";

import { useEffect, useState } from "react";
import { PlanCard } from "@/components/PlanCard";
import { Loader2 } from "lucide-react";

const TERMINAL = ["CANCELLED", "EXPIRED", "FULLY_PAID", "COMPLETED", "REFUNDED"];

export function DashboardPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/reservations");
      if (res.ok) {
        const data = await res.json();
        setPlans(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  const visible = showAll
    ? plans
    : plans.filter((p) => !TERMINAL.includes(p.status));

  if (!plans.length) {
    return <p className="text-sm text-construction-gray p-4">No active plans yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-primary-600 font-medium"
        >
          {showAll ? "Hide completed / cancelled" : "Show all history"}
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-slate-500 p-4">No active plans. Cleared history is hidden.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((p) => (
            <PlanCard key={p.id} plan={p} onUpdated={load} />
          ))}
        </div>
      )}
    </div>
  );
}
