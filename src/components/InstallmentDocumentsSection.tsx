"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Download,
  Loader2,
  AlertCircle,
  Upload,
  Camera,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { SignaturePad } from "@/components/SignaturePad";

type ReqDef = {
  key: string;
  label: string;
  instruction?: string;
  required?: boolean;
  inputType?: string;
};

type DocRow = {
  id: string;
  type: string;
  label?: string;
  status?: string;
  fileUrl?: string | null;
  textValue?: string | null;
  metaJson?: string | null;
  rejectReason?: string | null;
  required?: boolean;
  reused?: boolean;
};

const STATUS_STYLE: Record<string, string> = {
  NOT_UPLOADED: "bg-slate-100 text-slate-600",
  PENDING: "bg-slate-100 text-slate-600",
  UNDER_REVIEW: "bg-amber-50 text-amber-800",
  APPROVED: "bg-green-50 text-green-800",
  REJECTED: "bg-red-50 text-red-800",
};

type FormFields = { name: string; phone: string; address: string; relationship: string };

export function InstallmentDocumentsSection({
  reservationId,
  category,
  clientType: clientTypeProp = "INDIVIDUAL",
  onOverallChange,
}: {
  reservationId: string;
  category: string;
  clientType?: "INDIVIDUAL" | "COMPANY";
  onOverallChange?: (overall: string, canPayDeposit: boolean) => void;
}) {
  const [clientType, setClientType] = useState(clientTypeProp);
  const [defs, setDefs] = useState<ReqDef[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [overall, setOverall] = useState("INCOMPLETE");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [msg, setMsg] = useState("");
  const [textDraft, setTextDraft] = useState<Record<string, string>>({});
  const [formDraft, setFormDraft] = useState<Record<string, FormFields>>({});
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [showReplace, setShowReplace] = useState<Record<string, boolean>>({});

  const byType = useMemo(() => {
    const m = new Map<string, DocRow>();
    docs.forEach((d) => m.set(d.type, d));
    return m;
  }, [docs]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [reqRes, docRes] = await Promise.all([
        fetch(
          `/api/installment-docs/required?category=${encodeURIComponent(category)}&clientType=${clientType}`
        ),
        fetch(`/api/installment-docs?reservationId=${encodeURIComponent(reservationId)}`, {
          credentials: "include",
        }),
      ]);
      const reqData = await reqRes.json();
      const docData = await docRes.json();
      if (reqRes.ok) setDefs(reqData.documents || []);
      if (docRes.ok) {
        setDocs(docData.documents || []);
        setOverall(docData.overall || "INCOMPLETE");
        if (docData.message) setInfo(docData.message);
        onOverallChange?.(docData.overall || "INCOMPLETE", docData.overall === "APPROVED");
      }
      try {
        const sigRes = await fetch("/api/signature", { credentials: "include" });
        if (sigRes.ok) {
          const sig = await sigRes.json();
          setSignatureUrl(sig.signatureUrl || null);
        }
      } catch {
        /* */
      }
    } catch {
      setMsg("Could not load document requirements");
    } finally {
      setLoading(false);
    }
  }, [category, clientType, reservationId, onOverallChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadFile(key: string, label: string, required: boolean, file: File) {
    const okType =
      ["application/pdf", "image/jpeg", "image/jpg", "image/png"].includes(file.type) ||
      /\.(pdf|jpe?g|png)$/i.test(file.name);
    if (!okType) {
      setMsg("Only PDF, JPG or PNG allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg("Max 5MB per file");
      return;
    }
    setBusyKey(key);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "installment-docs");
      const up = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error || "Upload failed");

      const res = await fetch("/api/installment-docs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          key,
          label,
          fileUrl: upData.url || upData.blobUrl,
          fileName: file.name,
          required,
          inputType: "FILE",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setShowReplace((s) => ({ ...s, [key]: false }));
      setMsg(data.message || "Document uploaded for review");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusyKey("");
    }
  }

  async function saveText(key: string, label: string, required: boolean) {
    const value = (textDraft[key] || "").trim();
    if (!value) {
      setMsg("Enter a value");
      return;
    }
    setBusyKey(key);
    try {
      const res = await fetch("/api/installment-docs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          key,
          label,
          textValue: value,
          fileUrl: "",
          required,
          inputType: "TEXT",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setShowReplace((s) => ({ ...s, [key]: false }));
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusyKey("");
    }
  }

  function formFields(key: string, row?: DocRow): FormFields {
    const existing = formDraft[key];
    if (existing) return existing;
    let parsed: any = {};
    try {
      if (row?.metaJson) parsed = JSON.parse(row.metaJson);
    } catch {
      /* */
    }
    return {
      name: parsed.name || "",
      phone: parsed.phone || "",
      address: parsed.address || "",
      relationship: parsed.relationship || "",
    };
  }

  function setFormField(key: string, field: keyof FormFields, value: string, row?: DocRow) {
    const base = formFields(key, row);
    setFormDraft((s) => ({ ...s, [key]: { ...base, [field]: value } }));
  }

  async function saveFormMeta(
    key: string,
    label: string,
    required: boolean,
    inputType: "FORM" | "GUARANTOR"
  ) {
    const f = formDraft[key] || formFields(key);
    if (!f.name.trim() || !f.phone.trim()) {
      setMsg("Name and phone are required");
      return;
    }
    setBusyKey(key);
    setMsg("");
    try {
      const res = await fetch("/api/installment-docs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          key,
          label,
          fileUrl: "",
          textValue: `${f.name} · ${f.phone}`,
          meta: {
            name: f.name.trim(),
            phone: f.phone.trim(),
            address: f.address.trim(),
            relationship: f.relationship.trim(),
          },
          required,
          inputType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setShowReplace((s) => ({ ...s, [key]: false }));
      setMsg(data.message || "Details saved for review");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusyKey("");
    }
  }

  const requiredTotal = defs.filter((d) => d.required).length;
  const requiredDone = defs.filter((d) => {
    if (!d.required) return false;
    const row = byType.get(d.key);
    return row?.status === "APPROVED" || row?.status === "UNDER_REVIEW" || row?.status === "PENDING";
  }).length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading documents…
      </div>
    );
  }

  return (
    <div className="border rounded-2xl bg-white p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-construction-dark flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            Installment documents
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Approved documents from earlier plans are reused automatically. Only upload again if you
            need to update a file.
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            STATUS_STYLE[overall] || STATUS_STYLE.PENDING
          }`}
        >
          {overall.replace(/_/g, " ")}
        </span>
      </div>

      {info && (
        <div className="text-xs text-green-800 bg-green-50 border border-green-100 rounded-xl px-3 py-2 flex gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          {info}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <label className="text-xs font-medium text-slate-600">Client type</label>
        <select
          value={clientType}
          onChange={(e) => setClientType(e.target.value as "INDIVIDUAL" | "COMPANY")}
          className="text-sm border rounded-lg px-2 py-1.5"
        >
          <option value="INDIVIDUAL">Individual</option>
          <option value="COMPANY">Company</option>
        </select>
      </div>

      <SignaturePad existingUrl={signatureUrl} onSaved={(url) => setSignatureUrl(url)} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg ${
            signatureUrl ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
          }`}
          onClick={async () => {
            if (!signatureUrl) {
              setMsg("Save your signature first so it can be stamped on the agreement.");
              return;
            }
            setMsg("Generating agreement PDF…");
            try {
              let signatureDataUrl: string | null = null;
              try {
                signatureDataUrl = sessionStorage.getItem("hama_sig_data");
              } catch {
                /* */
              }
              const res = await fetch("/api/installment-docs/agreement", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reservationId, signatureDataUrl }),
              });
              if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Could not generate PDF");
              }
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "hama-installment-agreement.pdf";
              a.click();
              URL.revokeObjectURL(url);
              setMsg("Agreement downloaded with your signature and company seal.");
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "Download failed");
            }
          }}
        >
          <Download className="w-3.5 h-3.5" />
          Download agreement PDF
          {signatureUrl ? " (seal + signature)" : " (signature required)"}
        </button>
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>
            {requiredDone} of {requiredTotal} required documents ready
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-500 transition-all"
            style={{
              width: `${requiredTotal ? Math.min(100, (requiredDone / requiredTotal) * 100) : 0}%`,
            }}
          />
        </div>
      </div>

      {msg && (
        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2 flex gap-2 items-start">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {msg}
        </p>
      )}

      <div className="space-y-3">
        {defs.map((def) => {
          const row = byType.get(def.key);
          const status = row?.status || "NOT_UPLOADED";
          const busy = busyKey === def.key;
          const approved = status === "APPROVED";
          const replacing = showReplace[def.key] === true;
          const needsUpload = !approved || replacing || status === "REJECTED";
          const f = formFields(def.key, row);

          return (
            <div key={def.key} className="border rounded-xl p-3 sm:p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-construction-dark">
                    {def.label}{" "}
                    <span
                      className={`text-[10px] uppercase font-bold ml-1 ${
                        def.required ? "text-red-600" : "text-slate-400"
                      }`}
                    >
                      {def.required ? "Required" : "Optional"}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{def.instruction}</p>
                  {approved && (
                    <p className="text-[11px] text-green-700 mt-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {row?.reused ? "Reused from a previous approved plan" : "Approved"}
                    </p>
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    STATUS_STYLE[status] || STATUS_STYLE.PENDING
                  }`}
                >
                  {status.replace(/_/g, " ")}
                </span>
              </div>

              {status === "REJECTED" && row?.rejectReason && (
                <p className="text-xs text-red-700 bg-red-50 rounded-lg px-2 py-1.5">
                  Rejected: {row.rejectReason}. Re-upload below.
                </p>
              )}

              {approved && !replacing && (
                <div className="flex flex-wrap gap-2 items-center">
                  {row?.fileUrl && (
                    <a
                      href={row.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary-600 underline"
                    >
                      View file
                    </a>
                  )}
                  {row?.textValue && (
                    <span className="text-xs text-slate-600">Saved: {row.textValue}</span>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 border px-2.5 py-1.5 rounded-lg"
                    onClick={() => setShowReplace((s) => ({ ...s, [def.key]: true }))}
                  >
                    <RefreshCw className="w-3 h-3" /> Update document
                  </button>
                </div>
              )}

              {needsUpload && def.inputType === "TEXT" && (
                <div className="flex flex-wrap gap-2">
                  <input
                    value={textDraft[def.key] ?? row?.textValue ?? ""}
                    onChange={(e) => setTextDraft((s) => ({ ...s, [def.key]: e.target.value }))}
                    placeholder={def.key === "bvn" ? "11-digit BVN" : def.label}
                    className="flex-1 min-w-[140px] border rounded-lg px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveText(def.key, def.label, !!def.required)}
                    className="text-xs font-semibold bg-primary-600 text-white px-3 py-2 rounded-lg"
                  >
                    {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : approved ? "Update" : "Save"}
                  </button>
                </div>
              )}

              {needsUpload && (def.inputType === "FORM" || def.inputType === "GUARANTOR") && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] text-slate-500">
                    {def.inputType === "GUARANTOR"
                      ? "Enter guarantor details (name and phone required)."
                      : "Enter next of kin details (name and phone required)."}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      value={f.name}
                      onChange={(e) => setFormField(def.key, "name", e.target.value, row)}
                      placeholder="Full name *"
                      className="border rounded-lg px-3 py-2 text-sm bg-white"
                    />
                    <input
                      value={f.phone}
                      onChange={(e) => setFormField(def.key, "phone", e.target.value, row)}
                      placeholder="Phone *"
                      className="border rounded-lg px-3 py-2 text-sm bg-white"
                    />
                    <input
                      value={f.relationship}
                      onChange={(e) => setFormField(def.key, "relationship", e.target.value, row)}
                      placeholder="Relationship"
                      className="border rounded-lg px-3 py-2 text-sm bg-white"
                    />
                    <input
                      value={f.address}
                      onChange={(e) => setFormField(def.key, "address", e.target.value, row)}
                      placeholder="Address"
                      className="border rounded-lg px-3 py-2 text-sm bg-white sm:col-span-2"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        saveFormMeta(
                          def.key,
                          def.label,
                          !!def.required,
                          def.inputType === "GUARANTOR" ? "GUARANTOR" : "FORM"
                        )
                      }
                      className="text-xs font-semibold bg-primary-600 text-white px-3 py-2 rounded-lg disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save details"}
                    </button>
                    {def.inputType === "GUARANTOR" && (
                      <label className="inline-flex items-center gap-2 text-xs font-semibold text-primary-700 cursor-pointer border border-primary-200 bg-white px-3 py-2 rounded-lg">
                        <Upload className="w-3.5 h-3.5" />
                        Upload ID / photo (optional)
                        <input
                          type="file"
                          accept="image/*,.pdf,application/pdf"
                          className="hidden"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadFile(def.key, def.label, !!def.required, file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {needsUpload && (def.inputType === "FILE" || !def.inputType) && (
                <div className="flex flex-wrap gap-2 items-center">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-primary-700 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {busy
                      ? "Uploading…"
                      : approved
                        ? "Upload new version"
                        : row?.fileUrl
                          ? "Replace file"
                          : "Upload file"}
                    <input
                      type="file"
                      accept="image/*,.pdf,application/pdf"
                      capture="environment"
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFile(def.key, def.label, !!def.required, file);
                      }}
                    />
                    <Camera className="w-3.5 h-3.5 text-slate-400" />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
