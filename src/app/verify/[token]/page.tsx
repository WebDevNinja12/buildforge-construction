"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function VerifyContractPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/verify/${token}`);
        const json = await res.json();
        setData(json);
      } catch {
        setData({ valid: false, reason: "Could not verify" });
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const valid = !!data?.valid;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white border rounded-2xl shadow-sm p-6 text-center">
        <div
          className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center ${
            valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {valid ? <ShieldCheck className="w-7 h-7" /> : <ShieldX className="w-7 h-7" />}
        </div>
        <h1 className="text-xl font-bold text-construction-dark mt-4">
          {valid ? "Valid agreement" : "Not valid"}
        </h1>
        {!valid && data?.reason && (
          <p className="text-sm text-red-600 mt-2">{data.reason}</p>
        )}
        <dl className="mt-6 text-left text-sm space-y-2">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Client</dt>
            <dd className="font-medium">{data?.clientName || "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Contract</dt>
            <dd className="font-medium">{data?.contractNumber || "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Service</dt>
            <dd className="font-medium text-right">{data?.service || "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium">{data?.status || "—"}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Issued</dt>
            <dd className="font-medium">{formatDate(data?.issuedAt)}</dd>
          </div>
        </dl>
        {data?.extra && (
          <div className="mt-4 text-left text-xs bg-slate-50 rounded-xl p-3">
            <p className="font-semibold mb-1">Staff details</p>
            <p>Payment: {data.extra.paymentMethod}</p>
            <p>Total: {data.extra.totalAmount}</p>
            <p>Balance: {data.extra.balance ?? "—"}</p>
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-6">Hama Construction · public verification</p>
      </div>
    </div>
  );
}
