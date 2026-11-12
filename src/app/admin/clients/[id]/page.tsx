"use client";

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

function docKey(d: any) {
  const raw = String(d.type || d.label || d.id || "other")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  if (/^nin$|national.?id/.test(raw)) return "nin";
  if (/^bvn$/.test(raw)) return "bvn";
  if (/valid.?id|national.?identity|id_card/.test(raw)) return "valid_id";
  if (/passport|photo/.test(raw)) return "passport_photo";
  if (/proof.?of.?address|address/.test(raw)) return "proof_of_address";
  if (/bank.?statement/.test(raw)) return "bank_statement";
  if (/proof.?of.?income|income/.test(raw)) return "proof_of_income";
  if (/source.?of.?funds/.test(raw)) return "source_of_funds";
  if (/signed.?installment|installment.?agreement|agreement/.test(raw)) return "signed_agreement";
  if (/next.?of.?kin/.test(raw)) return "next_of_kin";
  if (/second.?guarantor|guarantor.?2/.test(raw)) return "guarantor_2";
  if (/guarantor.?1.?id|guarantor_id/.test(raw)) return "guarantor_1_id";
  if (/guarantor/.test(raw)) return "guarantor_1";
  return raw || "other";
}

const STATUS_RANK: Record<string, number> = {
  APPROVED: 4,
  VERIFIED: 4,
  UNDER_REVIEW: 3,
  PENDING: 2,
  PENDING_APPROVAL: 2,
  REJECTED: 1,
};

const DOC_GROUPS: { id: string; title: string; keys: string[] }[] = [
  { id: "identity", title: "Identity", keys: ["nin", "bvn", "valid_id", "passport_photo"] },
  {
    id: "address_finance",
    title: "Address & finances",
    keys: ["proof_of_address", "bank_statement", "proof_of_income", "source_of_funds"],
  },
  {
    id: "guarantors",
    title: "Guarantors & next of kin",
    keys: ["guarantor_1", "guarantor_2", "guarantor_1_id", "next_of_kin"],
  },
  { id: "agreements", title: "Agreements", keys: ["signed_agreement"] },
];

export default function AdminClientProfilePage() {
  const params = useParams();
  const id = String(params?.id || "");
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [reviews, setReviews] = useState<
    Record<string, { status: string; rejectReason: string }>
  >({});
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

  const allDocsRaw = useMemo(() => {
    const reg = (data?.registrationDocuments || []).map((d: any) => ({
      ...d,
      source: "REGISTRATION" as const,
    }));
    const inst = (data?.installmentDocuments || []).map((d: any) => ({
      ...d,
      source: "INSTALLMENT" as const,
    }));
    return [...reg, ...inst];
  }, [data]);

  const uniqueDocs = useMemo(() => {
    const map = new Map<string, any>();
    const sorted = [...allDocsRaw].sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return tb - ta;
    });
    for (const d of sorted) {
      const key = docKey(d);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, d);
        continue;
      }
      const pr = STATUS_RANK[(prev.status || "").toUpperCase()] || 0;
      const cr = STATUS_RANK[(d.status || "").toUpperCase()] || 0;
      if (cr > pr) map.set(key, d);
    }
    return Array.from(map.values());
  }, [allDocsRaw]);

  const allDocs = uniqueDocs;

  const fileDocs = useMemo(
    () => allDocs.filter((d: any) => d.fileUrl),
    [allDocs]
  );

  const pendingReviewCount = useMemo(
    () =>
      allDocs.filter((d: any) =>
        ["PENDING", "UNDER_REVIEW", "PENDING_APPROVAL"].includes(
          String(d.status || "").toUpperCase()
        )
      ).length,
    [allDocs]
  );

  const groupedDocs = useMemo(() => {
    const used = new Set<string>();
    const groups = DOC_GROUPS.map((g) => {
      const items = allDocs.filter((d: any) => {
        const k = docKey(d);
        if (used.has(k)) return false;
        if (g.keys.includes(k)) {
          used.add(k);
          return true;
        }
        return false;
      });
      return { id: g.id, title: g.title, items };
    }).filter((g) => g.items.length > 0);

    const other = allDocs.filter((d: any) => !used.has(docKey(d)));
    if (other.length) groups.push({ id: "other", title: "Other", items: other });
    return groups;
  }, [allDocs]);

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
        body: JSON.stringify({ action: "REVIEW_DOCS", reviews: payload }),
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

  const nin =
    identityValue(data.typedIdentityFields, "nin") || (u as any).nin || null;
  const bvn =
    identityValue(data.typedIdentityFields, "bvn") || (u as any).bvn || null;

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
    <div className="space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-1 text-sm text-primary-600 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Clients
          </Link>
          <h1 className="text-2xl font-bold text-construction-dark">{u.name}</h1>
          <p className="text-sm text-slate-500">{u.email}</p>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusColor(u.verificationStatus || u.status)}`}>
          {(u.verificationStatus || u.status || "—").replace(/_/g, " ")}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={finalApprove}
          className="min-h-[40px] px-4 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          Final verify
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={generateAgreement}
          className="min-h-[40px] px-4 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
        >
          Generate agreement PDF
        </button>
      </div>

      {msg && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2">
          {msg}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-[36px] px-3 rounded-full text-xs font-semibold transition-colors ${
              tab === t.id
                ? "bg-construction-dark text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white border rounded-2xl p-4 space-y-1 text-sm">
            <h2 className="font-bold text-construction-dark">Client details</h2>
            <p>Phone: {u.phone || "—"}</p>
            <p>
              NIN: <span className="text-primary-700 font-medium">{nin || "Not provided"}</span>
            </p>
            <p>
              BVN: <span className="text-primary-700 font-medium">{bvn || "Not provided"}</span>
            </p>
            <p>Status: {u.status}</p>
            <p>Joined: {formatDate(u.createdAt)}</p>
          </div>
          <div className="bg-white border rounded-2xl p-4 space-y-1 text-sm">
            <h2 className="font-bold text-construction-dark">Summary</h2>
            <p>Reservations: {data.reservations?.length || 0}</p>
            <p>Payments: {data.payments?.length || 0}</p>
            <p>Documents (unique): {allDocs.length}</p>
            <p>Contracts: {data.contracts?.length || 0}</p>
            <p>Tool rentals: {data.toolRentals?.length || 0}</p>
          </div>
        </div>
      )}

      {tab === "documents" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-construction-dark">Document review</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {allDocs.length} unique type{allDocs.length === 1 ? "" : "s"}
                {allDocsRaw.length > allDocs.length
                  ? ` · ${allDocsRaw.length - allDocs.length} duplicate upload(s) hidden`
                  : ""}
                {pendingReviewCount > 0
                  ? ` · ${pendingReviewCount} awaiting decision`
                  : " · all current items decided"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setGalleryIndex(0);
                  setGalleryOpen(true);
                }}
                disabled={!fileDocs.length}
                className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Gallery ({fileDocs.length})
              </button>
              <button
                type="button"
                disabled={busy || !Object.keys(reviews).length}
                onClick={submitReviews}
                className="min-h-[40px] px-4 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {busy ? "Saving…" : "Submit review"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold text-xs uppercase tracking-wide text-amber-800/80 mb-1">
              Identity on file
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>
                <span className="text-amber-800/70">NIN</span>{" "}
                <span className="font-semibold">{nin || "—"}</span>
              </span>
              <span>
                <span className="text-amber-800/70">BVN</span>{" "}
                <span className="font-semibold">{bvn || "—"}</span>
              </span>
            </div>
          </div>

          {groupedDocs.map((group) => (
            <div key={group.id} className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-0.5">
                {group.title}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {group.items.map((d: any) => {
                  const status = String(d.status || "PENDING").toUpperCase();
                  const pending = reviews[d.id];
                  return (
                    <div
                      key={d.id}
                      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-construction-dark truncate">
                            {d.label || d.type || "Document"}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {d.source === "REGISTRATION" ? "Registration" : "Installment"}
                            {d.updatedAt || d.createdAt
                              ? ` · ${formatDate(d.updatedAt || d.createdAt)}`
                              : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(
                            status
                          )}`}
                        >
                          {status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {d.fileUrl ? (
                        <a
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-primary-700 hover:underline inline-flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Open file
                        </a>
                      ) : (
                        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-2.5 py-2 break-all">
                          {d.textValue || d.value || "—"}
                        </p>
                      )}

                      <div className="mt-auto flex gap-2 pt-1">
                        <button
                          type="button"
                          className={`flex-1 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors ${
                            pending?.status === "APPROVED"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-emerald-50 text-emerald-800 border-emerald-100 hover:bg-emerald-100"
                          }`}
                          onClick={() =>
                            setReviews((r) => ({
                              ...r,
                              [d.id]: { status: "APPROVED", rejectReason: "" },
                            }))
                          }
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                          {status === "APPROVED" && !pending ? "Approved" : "Approve"}
                        </button>
                        <button
                          type="button"
                          className={`flex-1 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors ${
                            pending?.status === "REJECTED"
                              ? "bg-red-600 text-white border-red-600"
                              : "bg-red-50 text-red-800 border-red-100 hover:bg-red-100"
                          }`}
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
                          <XCircle className="w-3.5 h-3.5 inline mr-1" />
                          Reject
                        </button>
                      </div>
                      {pending?.status === "REJECTED" && (
                        <input
                          className="w-full border border-red-100 rounded-xl px-3 py-2 text-xs"
                          placeholder="Rejection remark (required)"
                          value={pending.rejectReason || ""}
                          onChange={(e) =>
                            setReviews((r) => ({
                              ...r,
                              [d.id]: { status: "REJECTED", rejectReason: e.target.value },
                            }))
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {!allDocs.length && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
              No documents uploaded yet.
            </div>
          )}
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
          {!data.reservations?.length && (
            <p className="text-slate-500 text-sm">No reservations.</p>
          )}
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
          {!(data.reservations || []).some((r: any) => r.paymentType === "INSTALLMENT") && (
            <p className="text-slate-500 text-sm">No installment plans.</p>
          )}
        </div>
      )}

      {tab === "payments" && (
        <div className="space-y-2">
          {(data.payments || []).map((p: any) => (
            <div key={p.id} className="border rounded-xl p-3 bg-white text-sm flex justify-between gap-2">
              <div>
                <p className="font-semibold">₦{Number(p.amount || 0).toLocaleString("en-NG")}</p>
                <p className="text-xs text-slate-500">{formatDate(p.createdAt)}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full h-fit ${statusColor(p.status)}`}>
                {p.status}
              </span>
            </div>
          ))}
          {!data.payments?.length && <p className="text-slate-500 text-sm">No payments.</p>}
        </div>
      )}

      {tab === "contracts" && (
        <div className="space-y-2">
          {(data.contracts || []).map((c: any) => (
            <div key={c.id} className="border rounded-xl p-3 bg-white text-sm flex justify-between gap-2">
              <div>
                <p className="font-semibold">{c.contractNumber}</p>
                <p className="text-xs text-slate-500">{c.serviceTitle || "Agreement"}</p>
              </div>
              {c.pdfUrl && (
                <a href={c.pdfUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary-700">
                  PDF
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
          {!data.activity?.length && <p className="text-slate-500 text-sm">No activity.</p>}
        </div>
      )}

      {galleryOpen && fileDocs.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setGalleryOpen(false)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <p className="font-semibold text-sm">
                {fileDocs[galleryIndex]?.label || fileDocs[galleryIndex]?.type} ({galleryIndex + 1}/
                {fileDocs.length})
              </p>
              <button type="button" className="text-sm text-slate-500" onClick={() => setGalleryOpen(false)}>
                Close
              </button>
            </div>
            {fileDocs[galleryIndex]?.fileUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fileDocs[galleryIndex].fileUrl}
                alt=""
                className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-50"
              />
            )}
            <div className="flex justify-between mt-3">
              <button
                type="button"
                className="text-sm font-semibold"
                disabled={galleryIndex <= 0}
                onClick={() => setGalleryIndex((i) => Math.max(0, i - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="text-sm font-semibold"
                disabled={galleryIndex >= fileDocs.length - 1}
                onClick={() => setGalleryIndex((i) => Math.min(fileDocs.length - 1, i + 1))}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
