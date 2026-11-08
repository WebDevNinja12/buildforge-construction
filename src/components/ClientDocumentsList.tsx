"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, ExternalLink } from "lucide-react";
import { statusBadgeClass, formatDate } from "@/lib/utils";

export function ClientDocumentsList() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [instRes, profileRes] = await Promise.all([
          fetch("/api/installment-docs", { credentials: "include" }),
          fetch("/api/profile", { credentials: "include" }).catch(() => null),
        ]);
        const inst = await instRes.json().catch(() => ({}));
        const installmentDocs = Array.isArray(inst?.documents) ? inst.documents : [];

        let regDocs: any[] = [];
        if (profileRes && profileRes.ok) {
          const profile = await profileRes.json().catch(() => ({}));
          const list = profile?.documents || profile?.userDocuments || [];
          if (Array.isArray(list)) {
            regDocs = list.map((d: any) => ({
              ...d,
              label: d.label || d.type,
              source: "REGISTRATION",
            }));
          }
        }

        const merged = [...installmentDocs, ...regDocs];
        const seen = new Set<string>();
        const unique = merged.filter((d) => {
          const k = String(d.id || `${d.type}-${d.fileUrl}`);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setDocs(unique);
      } catch {
        setDocs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!docs.length) {
    return (
      <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-center">
        <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-700">No documents yet</p>
        <p className="text-xs text-slate-500 mt-1">
          When you choose installment payment on a reservation, upload required files on that plan card.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <li
          key={d.id}
          className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-construction-dark truncate">
              {d.label || d.type}
            </p>
            <p className="text-[11px] text-slate-500">{formatDate(d.createdAt || d.updatedAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(d.status)}`}
            >
              {(d.status || "PENDING").replace(/_/g, " ")}
            </span>
            {d.fileUrl ? (
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="min-h-[40px] inline-flex items-center gap-1 text-xs font-semibold text-primary-700 px-2"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
