"use client";

import { useEffect, useState } from "react";
import { PlanCard } from "@/components/PlanCard";
import { Loader2 } from "lucide-react";

export function DashboardPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/reservations");
      if (res.ok) setPlans(await res.json());
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

  if (!plans.length) {
    return <p className="text-sm text-construction-gray p-4">No active plans yet.</p>;
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {plans.map((p) => (
        <PlanCard key={p.id} plan={p} onUpdated={load} />
      ))}
    </div>
  );
}
