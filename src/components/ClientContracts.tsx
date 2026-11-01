"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { formatDate, statusBadgeClass } from "@/lib/utils";

export function ClientContracts() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/contracts", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        setContracts(data.contracts || []);
      } catch {
        setContracts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!contracts.length) {
    return (
      <div className="bg-white border border-dashed rounded-2xl p-6 text-center">
        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-600">No contracts yet</p>
        <p className="text-xs text-slate-500 mt-1">
          After admin approves your documents, the agreement PDF will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {contracts.map((c) => (
        <li key={c.id} className="bg-white border rounded-xl px-4 py-3 flex flex-wrap justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{c.contractNumber}</p>
            <p className="text-xs text-slate-500">{c.serviceTitle}</p>
            <p className="text-[11px] text-slate-400">{formatDate(c.issuedAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(c.status)}`}>
              {c.status}
            </span>
            {c.pdfUrl && (
              <a
                href={c.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-primary-700 min-h-[40px] inline-flex items-center"
              >
                Download
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
