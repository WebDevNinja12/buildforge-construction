"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AdminActivityPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/activity", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setLogs(Array.isArray(data) ? data : data.logs || data.recentLogs || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Activity log</h1>
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : (
        <ul className="space-y-2">
          {logs.map((l: any) => (
            <li key={l.id} className="bg-white border rounded-xl px-4 py-3 text-sm">
              <p className="font-medium">{l.action}</p>
              <p className="text-xs text-slate-500">
                {l.admin?.name || l.adminId} · {formatDate(l.createdAt)}
                {l.entity ? ` · ${l.entity}` : ""}
              </p>
              {l.details && <p className="text-xs text-slate-600 mt-1">{l.details}</p>}
            </li>
          ))}
          {!logs.length && <p className="text-sm text-slate-500">No activity recorded yet.</p>}
        </ul>
      )}
    </div>
  );
}
