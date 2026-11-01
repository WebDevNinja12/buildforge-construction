"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function AdminWorkersPage() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/workers", { credentials: "include" });
      const data = await res.json().catch(() => []);
      setWorkers(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Workers</h1>
      <p className="text-sm text-slate-500">Manage worker profiles, photos and rates.</p>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {workers.map((w) => (
            <div key={w.id} className="bg-white border rounded-2xl p-4 flex gap-3">
              {w.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.image} alt="" className="w-14 h-14 rounded-full object-cover" />
              )}
              <div>
                <p className="font-semibold">{w.name}</p>
                <p className="text-xs text-slate-500">{w.specialty} · {w.location}</p>
                <p className="text-sm mt-1">Rate: {w.dailyRate}/day · Exp {w.experience}y</p>
              </div>
            </div>
          ))}
          {!workers.length && <p className="text-sm text-slate-500">No workers yet. Add via API or seed.</p>}
        </div>
      )}
    </div>
  );
}
