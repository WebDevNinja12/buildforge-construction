"use client";

import { useEffect, useState } from "react";
import { InstallmentDocumentsSection } from "@/components/InstallmentDocumentsSection";
import { Loader2, FileText } from "lucide-react";

/** Upload UI for active installment plans — Documents section only. */
export function ClientInstallmentDocUploads() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reservations", { credentials: "include" });
        const data = await res.json().catch(() => []);
        const list = Array.isArray(data) ? data : data?.plans || data?.reservations || [];
        const installment = list.filter((p: any) => {
          const method = String(p.paymentMethod || p.paymentType || "").toUpperCase();
          const st = String(p.status || "").toUpperCase();
          if (["CANCELLED", "EXPIRED", "REFUNDED"].includes(st)) return false;
          return method === "INSTALLMENT";
        });
        setPlans(installment);
      } catch {
        setPlans([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!plans.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        No installment plans need document uploads right now. When you choose installment on a
        reservation, required uploads appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {plans.map((p) => {
        const title = p.asset?.title || p.title || "Installment plan";
        const category = String(p.asset?.type || p.assetType || "HOUSE").toUpperCase();
        const docsStatus = String(p.docsStatus || "INCOMPLETE").toUpperCase();
        return (
          <div
            key={p.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-construction-dark flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-600" />
                  {title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {category} · Docs: {docsStatus.replace(/_/g, " ")}
                </p>
              </div>
            </div>
            <InstallmentDocumentsSection
              reservationId={p.id}
              category={category}
              onOverallChange={() => {}}
            />
          </div>
        );
      })}
    </div>
  );
}
