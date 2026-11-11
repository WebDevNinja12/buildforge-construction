"use client";

import { useEffect, useMemo, useState } from "react";
import { InstallmentDocumentsSection } from "@/components/InstallmentDocumentsSection";
import { Loader2, FileText, CheckCircle2, Building2 } from "lucide-react";

/**
 * One documents workspace for the client — not one form per reservation.
 * Reused/approved docs stay account-level; linked installment plans are listed once.
 */
export function ClientInstallmentDocUploads() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reservations", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
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

  const { primary, allApproved, pendingCount } = useMemo(() => {
    if (!plans.length) {
      return { primary: null as any, allApproved: false, pendingCount: 0 };
    }
    const needWork = plans.filter((p) => {
      const d = String(p.docsStatus || "INCOMPLETE").toUpperCase();
      return d !== "APPROVED";
    });
    const primary =
      needWork[0] ||
      plans.find((p) => String(p.docsStatus || "").toUpperCase() === "APPROVED") ||
      plans[0];
    return {
      primary,
      allApproved: needWork.length === 0 && plans.length > 0,
      pendingCount: needWork.length,
    };
  }, [plans]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!plans.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
        <FileText className="w-9 h-9 text-slate-300 mx-auto mb-2" />
        <p className="font-semibold text-construction-dark text-sm">No installment documents required</p>
        <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
          When you start an installment plan, required uploads appear here once. Approved files are
          reused automatically for later plans.
        </p>
      </div>
    );
  }

  const category = String(primary?.asset?.type || primary?.assetType || "HOUSE").toUpperCase();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-semibold text-construction-dark flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-600" />
              Installment verification
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Documents are shared across your installment plans. Upload once; approved files are
              reused automatically.
            </p>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              allApproved
                ? "bg-green-50 text-green-800 border border-green-100"
                : "bg-amber-50 text-amber-900 border border-amber-100"
            }`}
          >
            {allApproved
              ? "All plans verified"
              : pendingCount > 0
                ? `${pendingCount} plan${pendingCount > 1 ? "s" : ""} awaiting docs`
                : "In progress"}
          </span>
        </div>

        <ul className="mt-4 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
          {plans.map((p) => {
            const title = p.asset?.title || p.title || "Installment plan";
            const cat = String(p.asset?.type || p.assetType || "").toUpperCase();
            const docsStatus = String(p.docsStatus || "INCOMPLETE").toUpperCase();
            const approved = docsStatus === "APPROVED";
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5 bg-white text-sm"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-construction-dark truncate">{title}</p>
                    <p className="text-[11px] text-slate-500">{cat || "Asset"}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    approved ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {approved ? "Docs approved" : docsStatus.replace(/_/g, " ")}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {allApproved ? (
        <div className="rounded-2xl border border-green-100 bg-green-50/60 p-4 flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-green-900">Documents approved</p>
            <p className="text-sm text-green-800/90 mt-0.5">
              Your verified files apply to every installment plan above. You only need to upload
              again if you want to update a document.
            </p>
          </div>
        </div>
      ) : null}

      <InstallmentDocumentsSection
        reservationId={primary.id}
        category={category}
        clientType={(primary.clientType as "INDIVIDUAL" | "COMPANY") || "INDIVIDUAL"}
      />
    </div>
  );
}
