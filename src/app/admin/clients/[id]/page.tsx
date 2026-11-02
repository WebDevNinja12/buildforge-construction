use client;

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
} from "lucide-react";

type Tab =
  | "overview"
  | "documents"
  | "reservations"
  | "plans"
  | "payments"
  | "contracts"
  | "activity";

function formatDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return "—";
  }
}

function statusColor(s?: string) {
  const v = (s || "").toUpperCase();
  if (["APPROVED", "VERIFIED", "ACTIVE", "PAID", "COMPLETED"].includes(v))
    return "bg-emerald-100 text-emerald-800";
  if (["PENDING", "UNDER_REVIEW", "INCOMPLETE"].includes(v))
    return "bg-amber-100 text-amber-800";
  if (["REJECTED", "SUSPENDED", "CANCELLED", "EXPIRED", "OVERDUE"].includes(v))
    return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

function identityValue(fields: any[] | undefined, key: string) {
  if (!fields?.length) return null;
  const hit = fields.find((f) =>
    new RegExp(key, "i").test(String(f.type || "") + " " + String(f.label || ""))
  );
  return hit?.value || null;
}

export default function AdminClientProfilePage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [reviews, setReviews] = useState<Record<string, { status: string; rejectReason: string }>>({});
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/admin/clients/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  const u = data?.user;
  const allDocs = useMemo(() => {
    const reg = (data?.registrationDocuments || []).map((d: any) => ({
      ...d,
      source: "REGISTRATION",
    }));
    const inst = (data?.installmentDocuments || []).map((d: any) => ({
      ...d,
      source: "INSTALLMENT",
    }));
    return [...reg, ...inst];
  }, [data]);

  const fileDocs = useMemo(
    () => allDocs.filter((d: any) => d.fileUrl),
    [allDocs]
  );

  async function submitReviews() {
    setBusy(true);
    setMsg("");
    try {
      const payload = Object.entries(reviews)
        .filter(([, v]) => v.status)
        .map(([docId, v]) => {
          const doc = allDocs.find((d: any) => d.id === docId);
          return {
            id: docId,
            status: v.status,
            rejectReason: v.rejectReason || undefined,
            source: doc?.source === "REGISTRATION" ? "REGISTRATION" : "INSTALLMENT",
          };
        });
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "BATCH_REVIEW_DOCS", reviews: payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Review failed");
      setMsg("Reviews saved");
      setReviews({});
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function finalApprove() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FINAL_APPROVE" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Approve failed");
      setMsg("Client fully verified");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function generateAgreement() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "GENERATE_AGREEMENT" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generate failed");
      setMsg(`Agreement ${json.contract?.contractNumber || ""} created`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error}</p>
        <Link href="/admin/clients" className="text-primary-600 underline">
          Back to clients
        </Link>
      </div>
    );
  }

  if (!data || !u) {
    return (
      <div className="p-10 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const nin = identityValue(data.typedIdentityFields, "nin");
  const bvn = identityValue(data.typedIdentityFields, "bvn");

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents" },
    { id: "reservations", label: "Reservations" },
    { id: "plans", label: "Installment Plans" },
    { id: "payments", label: "Payments" },
    { id: "contracts", label: "Contracts" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/clients"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-construction-dark">{u.name}</h1>
            <p className="text-sm text-slate-500">{u.email}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColor(u.verificationStatus)}`}>
          {u.verificationStatus}
        </span>
      </div>

      {msg && (
        <div className="text-sm rounded-xl border px-4 py-3 bg-slate-50 text-slate-700">{msg}</div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={finalApprove}
          className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          Final verify
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={generateAgreement}
          className="min-h-[44px] px-4 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          Generate agreement PDF
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[40px] px-3 rounded-full text-sm whitespace-nowrap ${
              tab === t.id
                ? "bg-construction-dark text-white"
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
            <p>
              <span className="text-slate-500">Phone:</span> {u.phone || "—"}
            </p>
            <p>
              <span className="text-slate-500">Type:</span> {u.clientType}
            </p>
            <p className="font-semibold text-construction-dark">
              NIN: <span className="text-primary-700">{nin || "Not provided"}</span>
            </p>
            <p>
              <span className="text-slate-500">BVN:</span> {bvn || "—"}
            </p>
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
              <span className="font-bold">NIN:</span> {nin || "—"}
            </p>
            <p>BVN: {bvn || "—"}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {allDocs.map((d: any) => (
              <div key={d.id} className="border rounded-xl p-3 bg-white space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm">{d.label || d.type}</p>
                    <p className="text-xs text-slate-500">{d.source}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor(d.status)}`}>
                    {d.status}
                  </span>
                </div>
                {d.textValue && <p className="text-xs">Value: {d.textValue}</p>}
                {d.fileUrl && (
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-primary-600 underline">
                    Open file
                  </a>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="min-h-[40px] flex-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                    onClick={() =>
                      setReviews((r) => ({
                        ...r,
                        [d.id]: { status: "APPROVED", rejectReason: "" },
                      }))
                    }
                  >
                    <CheckCircle2 className="w-3 h-3 inline mr-1" />
                    Approve
                  </button>
                  <button
                    type="button"
                    className="min-h-[40px] flex-1 rounded-lg bg-red-600 text-white text-xs font-semibold"
                    onClick={() =>
                      setReviews((r) => ({
                        ...r,
                        [d.id]: {
                          status: "REJECTED",
                          rejectReason: r[d.id]?.rejectReason || "",
                        },
                      }))
                    }
                  >
                    <XCircle className="w-3 h-3 inline mr-1" />
                    Reject
                  </button>
                </div>
                {reviews[d.id]?.status === "REJECTED" && (
                  <input
                    className="w-full border rounded-lg px-2 py-2 text-xs"
                    placeholder="Remark required"
                    value={reviews[d.id]?.rejectReason || ""}
                    onChange={(e) =>
                      setReviews((r) => ({
                        ...r,
                        [d.id]: { status: "REJECTED", rejectReason: e.target.value },
                      }))
                    }
                  />
                )}
              </div>
            ))}
            {!allDocs.length && <p className="text-slate-500 text-sm">No documents yet.</p>}
          </div>
        </div>
      )}

      {tab === "reservations" && (
        <div className="space-y-2">
          {(data.reservations || []).map((r: any) => (
            <div key={r.id} className="border rounded-xl p-3 bg-white text-sm">
              <p className="font-semibold">{r.asset?.title || "Asset"}</p>
              <p className="text-xs text-slate-500">
                {r.status} · {r.paymentType || "—"} · expires {formatDate(r.expiresAt)}
              </p>
            </div>
          ))}
          {!data.reservations?.length && <p className="text-slate-500 text-sm">No reservations.</p>}
        </div>
      )}

      {tab === "plans" && (
        <div className="space-y-2">
          {(data.reservations || [])
            .filter((r: any) => r.paymentType === "INSTALLMENT")
            .map((r: any) => (
              <div key={r.id} className="border rounded-xl p-3 bg-white text-sm">
                <p className="font-semibold">{r.asset?.title}</p>
                <p>
                  Paid: {r.installmentPaid || 0} / {r.installmentTotal || r.asset?.price || 0}
                </p>
                <p className="text-xs">Next due: {formatDate(r.nextDueAt)}</p>
                <p className="text-xs">Deadline: {formatDate(r.planDeadlineAt)}</p>
                <p className="text-xs">Docs: {r.docsStatus}</p>
              </div>
            ))}
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-2">
          {(data.payments || []).map((p: any) => (
            <div key={p.id} className="border rounded-xl p-3 bg-white text-sm flex justify-between">
              <div>
                <p className="font-semibold">
                  {p.currency || "USD"} {p.amount}
                </p>
                <p className="text-xs text-slate-500">{p.type} · {formatDate(p.createdAt)}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full h-fit ${statusColor(p.status)}`}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "contracts" && (
        <div className="space-y-2">
          {(data.contracts || []).map((c: any) => (
            <div key={c.id} className="border rounded-xl p-3 bg-white text-sm">
              <p className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {c.contractNumber}
              </p>
              <p className="text-xs">{c.serviceTitle}</p>
              <p className="text-xs">Status: {c.status}</p>
              {c.pdfUrl && (
                <a href={c.pdfUrl} className="text-primary-600 underline text-xs" target="_blank" rel="noreferrer">
                  Download PDF
                </a>
              )}
            </div>
          ))}
          {!data.contracts?.length && <p className="text-slate-500 text-sm">No contracts yet.</p>}
        </div>
      )}

      {tab === "activity" && (
        <div className="space-y-2">
          {(data.activity || []).map((a: any) => (
            <div key={a.id} className="border rounded-xl p-3 bg-white text-xs">
              <p className="font-semibold">{a.action}</p>
              <p className="text-slate-500">{formatDate(a.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

      {galleryOpen && fileDocs.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
          <div className="flex justify-between items-center p-4 text-white">
            <p className="text-sm">
              {galleryIndex + 1} / {fileDocs.length} — {fileDocs[galleryIndex]?.label || fileDocs[galleryIndex]?.type}
            </p>
            <button type="button" className="min-h-[44px] px-4" onClick={() => setGalleryOpen(false)}>
              Close
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileDocs[galleryIndex].fileUrl}
              alt=""
              className="max-h-[70vh] max-w-full object-contain"
            />
          </div>
          <div className="flex justify-center gap-4 p-4">
            <button
              type="button"
              className="min-h-[44px] px-6 rounded-xl bg-white"
              onClick={() => setGalleryIndex((i) => (i - 1 + fileDocs.length) % fileDocs.length)}
            >
              Prev
            </button>
            <button
              type="button"
              className="min-h-[44px] px-6 rounded-xl bg-white"
              onClick={() => setGalleryIndex((i) => (i + 1) % fileDocs.length)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
