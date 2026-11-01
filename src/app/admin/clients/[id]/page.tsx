"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  FileText,
  Check,
  X,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDate, statusBadgeClass } from "@/lib/utils";
import { useToast } from "@/components/Toast";

type Tab =
  | "overview"
  | "documents"
  | "reservations"
  | "plans"
  | "payments"
  | "contracts"
  | "activity";

export default function AdminClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reviews, setReviews] = useState<Record<string, { status?: string; remark?: string }>>({});
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setData(json);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load", "err");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const allDocs = useMemo(() => {
    if (!data) return [] as any[];
    const reg = (data.registrationDocuments || []).map((d: any) => ({
      ...d,
      source: "REGISTRATION",
      group: "Registration documents",
    }));
    const inst = (data.installmentDocuments || []).map((d: any) => ({
      ...d,
      source: "INSTALLMENT",
      group: d.reservationId ? `Installment · ${d.reservationId.slice(-6)}` : "Installment documents",
    }));
    return [...reg, ...inst];
  }, [data]);

  const fileDocs = allDocs.filter((d) => d.fileUrl);

  async function submitReviews() {
    const payload = Object.entries(reviews)
      .filter(([, v]) => v.status)
      .map(([key, v]) => {
        const [source, docId] = key.split(":");
        return {
          id: docId,
          source,
          status: v.status,
          rejectReason: v.remark,
        };
      });
    if (!payload.length) {
      toast("Mark at least one document", "err");
      return;
    }
    for (const p of payload) {
      if (p.status === "REJECTED" && !p.rejectReason?.trim()) {
        toast("Remark required for each rejection", "err");
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "BATCH_REVIEW_DOCS", reviews: payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast("Review submitted");
      setReviews({});
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function finalApprove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FINAL_APPROVE" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast("Client approved / verified");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function generateAgreement(reservationId?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GENERATE_AGREEMENT", reservationId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast(`Agreement ${json.contract?.contractNumber} ready");
      load();
      setTab("contracts");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "err");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!data?.user) {
    return (
      <div className="space-y-3">
        <Link href="/admin/clients" className="text-sm text-primary-600">
          ← Clients
        </Link>
        <p className="text-slate-600">Client not found.</p>
      </div>
    );
  }

  const u = data.user;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents" },
    { id: "reservations", label: "Reservations" },
    { id: "plans", label: "Installment Plans" },
    { id: "payments", label: "Payments" },
    { id: "contracts", label: "Contracts" },
    { id: "activity", label: "Activity" },
  ];

  const requiredPending = (data.installmentDocuments || []).filter(
    (d: any) => d.required && d.status !== "APPROVED"
  );

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-1 text-sm text-primary-600 min-h-[40px]"
          >
            <ArrowLeft className="w-4 h-4" /> Clients
          </Link>
          <h1 className="text-2xl font-bold text-construction-dark">{u.name}</h1>
          <p className="text-sm text-slate-500 break-all">{u.email}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(u.status)}`}>
              {u.status}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(u.verificationStatus)}`}>
              {u.verificationStatus}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="min-h-[44px] px-3 rounded-xl border bg-white text-sm inline-flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            type="button"
            disabled={busy || requiredPending.length > 0}
            onClick={finalApprove}
            className="min-h-[44px] px-4 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50"
            title={requiredPending.length ? "Approve all required documents first" : ""}
          >
            Approve Client
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => generateAgreement()}
            className="min-h-[44px] px-4 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
          >
            Generate agreement
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap ${
              tab === t.id
                ? "bg-primary-600 text-white"
                : "bg-white border text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border rounded-2xl p-4 space-y-2 text-sm">
            <h2 className="font-bold text-construction-dark">Client details</h2>
            <p><span className="text-slate-500">Phone:</span> {u.phone || "—"}</p>
            <p><span className="text-slate-500">Type:</span> {u.clientType}</p>
            <p className="font-semibold text-construction-dark">
              NIN: <span className="text-primary-700">{u.nin || "Not provided"}</span>
            </p>
            <p><span className="text-slate-500">BVN:</span> {u.bvn || "—"}</p>
            <p className="text-xs text-slate-500">Joined {formatDate(u.createdAt)}</p>
          </div>
          <div className="bg-white border rounded-2xl p-4 space-y-2 text-sm">
            <h2 className="font-bold text-construction-dark">Summary</h2>
            <p>Reservations: {data.reservations?.length || 0}</p>
            <p>Payments: {data.payments?.length || 0}</p>
            <p>Documents: {allDocs.length}</p>
            <p>Contracts: {data.contracts?.length || 0}</p>
            <p>Tool rentals: {data.toolRentals?.length || 0}</p>
          </div>
        </div>
      )}

      {tab === "documents" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setGalleryIndex(0);
                setGalleryOpen(true);
              }}
              disabled={!fileDocs.length}
              className="min-h-[44px] px-4 rounded-xl bg-construction-dark text-white text-sm font-semibold disabled:opacity-50"
            >
              View All Documents
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={submitReviews}
              className="min-h-[44px] px-4 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              Submit Review
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm">
            <p className="font-semibold">Client details (compare with ID)</p>
            <p>
              <span className="font-bold">NIN:</span> {u.nin || "—"}
            </p>
            <p>BVN: {u.bvn || "—"}</p>
            <p>Name: {u.name}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {allDocs.length === 0 ? (
              <p className="text-sm text-slate-500">No documents uploaded.</p>
            ) : (
              allDocs.map((d) => {
                const key = `${d.source}:${d.id}`;
                const draft = reviews[key] || {};
                return (
                  <div key={key} className="bg-white border rounded-2xl p-3 space-y-2">
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{d.label || d.type}</p>
                        <p className="text-[11px] text-slate-500">{d.group}</p>
                        <p className="text-[11px] text-slate-400">{formatDate(d.createdAt)}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full h-fit ${statusBadgeClass(d.status)}`}>
                        {d.status}
                      </span>
                    </div>
                    {d.textValue && (
                      <p className="text-xs bg-slate-50 rounded-lg px-2 py-1">Value: {d.textValue}</p>
                    )}
                    {d.fileUrl && (
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary-600 inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Open file
                      </a>
                    )}
                    {d.previousFileUrl && (
                      <p className="text-[11px] text-slate-500">
                        Previous file kept · remark: {d.previousRejectReason || "—"}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setReviews((r) => ({ ...r, [key]: { ...r[key], status: "APPROVED", remark: "" } }))
                        }
                        className={`min-h-[40px] flex-1 text-xs font-semibold rounded-lg ${
                          draft.status === "APPROVED"
                            ? "bg-green-600 text-white"
                            : "border text-green-700"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 inline" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setReviews((r) => ({ ...r, [key]: { ...r[key], status: "REJECTED" } }))
                        }
                        className={`min-h-[40px] flex-1 text-xs font-semibold rounded-lg ${
                          draft.status === "REJECTED"
                            ? "bg-red-600 text-white"
                            : "border text-red-700"
                        }`}
                      >
                        <X className="w-3.5 h-3.5 inline" /> Reject
                      </button>
                    </div>
                    {draft.status === "REJECTED" && (
                      <textarea
                        placeholder="Remark required (e.g. Image not clear, upload again)"
                        value={draft.remark || ""}
                        onChange={(e) =>
                          setReviews((r) => ({
                            ...r,
                            [key]: { ...r[key], status: "REJECTED", remark: e.target.value },
                          }))
                        }
                        className="w-full border rounded-lg text-xs p-2 min-h-[60px]"
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === "reservations" && (
        <div className="space-y-2">
          {(data.reservations || []).length === 0 ? (
            <p className="text-sm text-slate-500">No reservations.</p>
          ) : (
            data.reservations.map((r: any) => (
              <div key={r.id} className="bg-white border rounded-xl p-4 text-sm">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{r.asset?.title}</p>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(r.status)}`}>
                    {r.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {r.paymentType || "No payment method"} · {formatCurrency(r.installmentTotal || r.asset?.price)}
                </p>
                <p className="text-xs text-slate-400">Expires {formatDate(r.expiresAt)}</p>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-primary-700"
                  onClick={() => generateAgreement(r.id)}
                >
                  Generate agreement for this booking
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "plans" && (
        <div className="space-y-2">
          {(data.reservations || [])
            .filter((r: any) => r.paymentType === "INSTALLMENT")
            .map((r: any) => (
              <div key={r.id} className="bg-white border rounded-xl p-4 text-sm">
                <p className="font-semibold">{r.asset?.title}</p>
                <p>
                  Paid {formatCurrency(r.installmentPaid)} / {formatCurrency(r.installmentTotal || r.asset?.price)}
                </p>
                <p className="text-xs text-slate-500">
                  Next due {formatDate(r.nextDueAt)} · Deadline {formatDate(r.planDeadlineAt)}
                </p>
                <p className="text-xs">Docs: {r.docsStatus}</p>
              </div>
            ))}
          {(data.reservations || []).filter((r: any) => r.paymentType === "INSTALLMENT").length === 0 && (
            <p className="text-sm text-slate-500">No installment plans.</p>
          )}
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-2">
          {(data.payments || []).length === 0 ? (
            <p className="text-sm text-slate-500">No payments.</p>
          ) : (
            data.payments.map((p: any) => (
              <div key={p.id} className="bg-white border rounded-xl px-4 py-3 flex justify-between text-sm">
                <div>
                  <p className="font-semibold">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-slate-500">{p.type} · {formatDate(p.createdAt)}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full h-fit ${statusBadgeClass(p.status)}`}>
                  {p.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "contracts" && (
        <div className="space-y-2">
          {(data.contracts || []).length === 0 ? (
            <p className="text-sm text-slate-500">No contracts yet. Generate an agreement after document approval.</p>
          ) : (
            data.contracts.map((c: any) => (
              <div key={c.id} className="bg-white border rounded-xl p-4 text-sm space-y-1">
                <p className="font-semibold">{c.contractNumber}</p>
                <p className="text-xs text-slate-500">{c.serviceTitle}</p>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${statusBadgeClass(c.status)}`}>
                  {c.status}
                </span>
                <div className="flex flex-wrap gap-3 pt-1">
                  {c.pdfUrl && (
                    <a href={c.pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-primary-600 font-semibold">
                      Download PDF
                    </a>
                  )}
                  <Link href={`/verify/${c.verifyToken}`} className="text-xs text-slate-600 font-semibold">
                    Open verification
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "activity" && (
        <ul className="space-y-2 text-sm">
          {(data.activity || []).length === 0 ? (
            <p className="text-slate-500">No activity logged for this client id yet.</p>
          ) : (
            data.activity.map((a: any) => (
              <li key={a.id} className="bg-white border rounded-xl px-4 py-3">
                <p className="font-medium">{a.action}</p>
                <p className="text-xs text-slate-500">{formatDate(a.createdAt)} · {a.entity}</p>
              </li>
            ))
          )}
        </ul>
      )}

      {/* Gallery modal */}
      {galleryOpen && fileDocs.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex items-center justify-between p-3 text-white">
            <p className="text-sm font-semibold">
              {galleryIndex + 1} / {fileDocs.length} · {fileDocs[galleryIndex]?.label || fileDocs[galleryIndex]?.type}
            </p>
            <button type="button" className="min-h-[44px] px-3" onClick={() => setGalleryOpen(false)}>
              Close
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-2 relative">
            <button
              type="button"
              className="absolute left-2 min-h-[44px] min-w-[44px] bg-white/20 text-white rounded-full"
              onClick={() => setGalleryIndex((i) => (i - 1 + fileDocs.length) % fileDocs.length)}
            >
              ‹
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileDocs[galleryIndex].fileUrl}
              alt=""
              className="max-h-[70vh] max-w-full object-contain rounded-lg"
            />
            <button
              type="button"
              className="absolute right-2 min-h-[44px] min-w-[44px] bg-white/20 text-white rounded-full"
              onClick={() => setGalleryIndex((i) => (i + 1) % fileDocs.length)}
            >
              ›
            </button>
          </div>
          <div className="p-3 flex justify-center gap-3 text-white text-sm">
            <a href={fileDocs[galleryIndex].fileUrl} download className="underline">
              Download
            </a>
            <span className={statusBadgeClass(fileDocs[galleryIndex].status)}>
              {fileDocs[galleryIndex].status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
