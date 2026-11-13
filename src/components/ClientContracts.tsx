"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Download, QrCode, ShieldCheck, Trash2 } from "lucide-react";
import { formatDate, statusBadgeClass } from "@/lib/utils";

function verifyPath(token: string) {
  return `/verify/${token}`;
}

function qrImageUrl(token: string) {
  if (typeof window === "undefined") return "";
  const absolute = `${window.location.origin}${verifyPath(token)}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(absolute)}`;
}

export function ClientContracts() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedQr, setExpandedQr] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [res, hideRes] = await Promise.all([
          fetch("/api/contracts", { credentials: "include" }),
          fetch("/api/history/clear", { credentials: "include" }),
        ]);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Failed to load contracts");
        setContracts(Array.isArray(data.contracts) ? data.contracts : []);
        if (hideRes.ok) {
          const h = await hideRes.json().catch(() => ({}));
          setHidden(new Set(Array.isArray(h.contracts) ? h.contracts.map(String) : []));
        }
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
          Signed agreement PDFs appear here after your first payment is approved (or when an admin
          generates the agreement). Download the PDF or open the verification page anytime.
        </p>
      </div>
    );
  }

  const list = contracts.filter((c) => !hidden.has(String(c.id)));

  async function cleanupSelected() {
    if (!selected.size) return;
    if (!confirm(`Remove ${selected.size} contract(s) from your history view?`)) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/history/clear", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractIds: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setHidden((h) => new Set([...h, ...selected]));
      setSelected(new Set());
      setMsg(data.message || "Cleaned up");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!list.length) {
    return (
      <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center">
        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-construction-dark text-sm">No contracts in view</p>
        <p className="text-xs text-slate-500 mt-1">History may have been cleaned up.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 min-h-[36px]">
          <input
            type="checkbox"
            checked={selected.size > 0 && selected.size === list.length}
            onChange={() => {
              if (selected.size === list.length) setSelected(new Set());
              else setSelected(new Set(list.map((c) => String(c.id))));
            }}
            className="rounded border-slate-300"
          />
          Select all ({list.length})
        </label>
        <button
          type="button"
          disabled={!selected.size || busy}
          onClick={cleanupSelected}
          className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Clean up selected ({selected.size})
        </button>
        {msg && <p className="text-xs text-slate-500 w-full">{msg}</p>}
      </div>
      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
        Each contract has a verification page and QR code. Share the link or show the QR for staff to
        confirm authenticity — the full web address is not required.
      </p>
      <ul className="space-y-3">
        {list.map((c) => {
          const token = c.verifyToken as string | undefined;
          const showQr = expandedQr === c.id;
          const id = String(c.id);
          return (
            <li
              key={id}
              className="bg-white border border-slate-200 rounded-2xl px-4 py-4 shadow-sm space-y-3"
            >
              <label className="inline-flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                <input
                  type="checkbox"
                  checked={selected.has(id)}
                  onChange={() => {
                    setSelected((prev) => {
                      const n = new Set(prev);
                      if (n.has(id)) n.delete(id);
                      else n.add(id);
                      return n;
                    });
                  }}
                  className="rounded border-slate-300"
                />
                Select for cleanup
              </label>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-construction-dark">
                    {c.contractNumber || "Agreement"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDate(c.issuedAt || c.createdAt)}
                    {c.status ? ` · ${c.status}` : ""}
                  </p>
                </div>
                {c.status && (
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${statusBadgeClass(
                      c.status
                    )}`}
                  >
                    {String(c.status).replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {c.pdfUrl && (
                  <a
                    href={c.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-primary-700 hover:bg-primary-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </a>
                )}
                {token && (
                  <>
                    <Link
                      href={verifyPath(token)}
                      target="_blank"
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verification page
                    </Link>
                    <button
                      type="button"
                      onClick={() => setExpandedQr((x) => (x === c.id ? null : c.id))}
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      {showQr ? "Hide QR" : "Show QR"}
                    </button>
                  </>
                )}
              </div>
              {token && showQr && (
                <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 border border-slate-100 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrImageUrl(token)}
                    alt="Verification QR"
                    width={128}
                    height={128}
                    className="rounded-lg bg-white border border-slate-200 p-1"
                  />
                  <div className="text-xs text-slate-600 space-y-1 max-w-xs">
                    <p className="font-semibold text-construction-dark">Scan to verify</p>
                    <p>
                      Staff can open{" "}
                      <Link href={verifyPath(token)} className="text-primary-700 font-semibold underline">
                        this verification page
                      </Link>{" "}
                      or scan the QR. You do not need to share a long URL.
                    </p>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
