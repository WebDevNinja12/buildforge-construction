"use client";

import { useEffect, useState } from "react";
import { X, Loader2, FileText, CreditCard, CalendarClock } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { parseFrequencies } from "@/lib/schedule";

interface CategoryConfig {
  category: string;
  name?: string;
  installmentRulesText?: string | null;
  continuesAfterHold?: boolean;
  installmentPlanMonths?: number | null;
  cancelDeductionPercent?: number;
  graceHours?: number;
  allowedFrequencies?: string;
  requiredDocs?: { key: string; label: string; required: boolean; description?: string | null }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  price: number;
  category: string;
  onConfirm: (payload: {
    paymentMethod: "FULL" | "INSTALLMENT";
    paymentFrequency?: string;
    documents: { key: string; label: string; fileUrl: string; fileName?: string }[];
  }) => Promise<void>;
}

export function PaymentMethodModal({ open, onClose, title, price, category, onConfirm }: Props) {
  const [method, setMethod] = useState<"FULL" | "INSTALLMENT" | null>(null);
  const [cfg, setCfg] = useState<CategoryConfig | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [frequency, setFrequency] = useState("MONTHLY");
  const [docs, setDocs] = useState<Record<string, { fileUrl: string; fileName: string }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setMethod(null);
    setAgreed(false);
    setDocs({});
    setError("");
    fetch(`/api/categories?category=${encodeURIComponent(category)}`)
      .then((r) => r.json())
      .then((data) => {
        setCfg(data);
        const freqs = parseFrequencies(data.allowedFrequencies);
        setFrequency(freqs[0] || "MONTHLY");
      })
      .catch(() => setCfg(null));
  }, [open, category]);

  if (!open) return null;

  const freqs = parseFrequencies(cfg?.allowedFrequencies);
  const requiredList = cfg?.requiredDocs?.filter((d) => d.required) || [];
  const allDocsUploaded =
    requiredList.length === 0 || requiredList.every((d) => docs[d.key]?.fileUrl);

  async function handleFile(key: string, file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setDocs((prev) => ({
        ...prev,
        [key]: { fileUrl: String(reader.result), fileName: file.name },
      }));
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (!method) return;
    if (method === "INSTALLMENT") {
      if (!agreed) {
        setError("You must agree to the installment rules");
        return;
      }
      if (!allDocsUploaded) {
        setError("Upload all required documents before continuing");
        return;
      }
    }
    setLoading(true);
    setError("");
    try {
      const documents =
        method === "INSTALLMENT"
          ? Object.entries(docs).map(([key, v]) => ({
              key,
              label: requiredList.find((d) => d.key === key)?.label || key,
              fileUrl: v.fileUrl,
              fileName: v.fileName,
            }))
          : [];
      await onConfirm({
        paymentMethod: method,
        paymentFrequency: method === "INSTALLMENT" ? frequency : undefined,
        documents,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const deposit = price * 0.1;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg text-construction-dark">Payment method</h2>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 border">
            <p className="font-semibold">{title}</p>
            <p className="text-accent-600 font-bold text-lg mt-1">{formatCurrency(price)}</p>
            <p className="text-xs text-slate-500 mt-1">Category: {category}</p>
          </div>

          {!method && (
            <div className="grid gap-3">
              <button type="button" onClick={() => setMethod("FULL")} className="text-left border-2 border-slate-200 hover:border-primary-500 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-6 h-6 text-primary-600" />
                  <div>
                    <p className="font-semibold">Full payment</p>
                    <p className="text-sm text-slate-500">Pay once after admin approval.</p>
                  </div>
                </div>
              </button>
              <button type="button" onClick={() => setMethod("INSTALLMENT")} className="text-left border-2 border-slate-200 hover:border-accent-500 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CalendarClock className="w-6 h-6 text-accent-600" />
                  <div>
                    <p className="font-semibold">Installment payment</p>
                    <p className="text-sm text-slate-500">Deposit {formatCurrency(deposit)}; choose frequency for the rest.</p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {method === "FULL" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Full amount {formatCurrency(price)} after admin approves payment.</p>
              <button type="button" onClick={() => setMethod(null)} className="text-sm text-primary-600">← Change method</button>
            </div>
          )}

          {method === "INSTALLMENT" && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                <p className="font-semibold flex items-center gap-2 mb-2"><FileText className="w-4 h-4" /> Rules — {cfg?.name || category}</p>
                <p className="whitespace-pre-wrap">{cfg?.installmentRulesText || "Loading…"}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  {freqs.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Schedule is generated automatically from this frequency and the plan deadline.</p>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
                <span className="text-sm">I have read and agree to these installment rules.</span>
              </label>

              {requiredList.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Required documents</p>
                  {requiredList.map((d) => (
                    <div key={d.key} className="border rounded-lg p-3">
                      <p className="text-sm font-medium">{d.label}</p>
                      <input type="file" accept="image/*,.pdf" className="mt-2 text-sm w-full" onChange={(e) => handleFile(d.key, e.target.files?.[0] || null)} />
                      {docs[d.key] && <p className="text-xs text-green-700 mt-1">Uploaded: {docs[d.key].fileName}</p>}
                    </div>
                  ))}
                </div>
              )}

              <button type="button" onClick={() => setMethod(null)} className="text-sm text-primary-600">← Change method</button>
            </div>
          )}

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          {method && (
            <button
              type="button"
              disabled={loading || (method === "INSTALLMENT" && (!agreed || !allDocsUploaded))}
              onClick={submit}
              className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm {method === "FULL" ? "full payment" : `${frequency.toLowerCase()} installment`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
