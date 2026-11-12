"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { formatDate, statusBadgeClass } from "@/lib/utils";

export function ClientContracts() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/contracts", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load contracts");
        setContracts(Array.isArray(data.contracts) ? data.contracts : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load contracts");
        setContracts([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {error}
      </div>
    );
  }

  if (!contracts.length) {
    return (
      <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center">
        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-construction-dark text-sm">No contracts yet</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          When your installment documents are approved and payment starts, signed agreement PDFs
          appear here for download and verification.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
        Each contract includes a verification token. Admins can scan QR codes to confirm authenticity.
      </p>
      <ul className="space-y-3">
        {contracts.map((c) => (
          <li
            key={c.id}
            className="bg-white border border-slate-200 rounded-2xl px-4 py-4 shadow-sm flex flex-wrap items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-construction-dark">
                {c.contractNumber || "Agreement"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {c.serviceTitle || "Service agreement"}
                {c.paymentMethod ? ` · ${c.paymentMethod}` : ""}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Issued {formatDate(c.issuedAt || c.createdAt)}
                {c.totalAmount != null
                  ? ` · ₦${Number(c.totalAmount).toLocaleString("en-NG")}`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(
                  c.status || "ACTIVE"
                )}`}
              >
                {c.status || "ACTIVE"}
              </span>
              {c.pdfUrl && (
                <a
                  href={c.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-primary-700 hover:bg-primary-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  PDF
                </a>
              )}
              {c.verifyToken && (
                <a
                  href={`/verify/${c.verifyToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Verify
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
