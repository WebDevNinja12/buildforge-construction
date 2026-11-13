"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Loader2,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  User,
  Briefcase,
  MapPin,
} from "lucide-react";
import { ExpandableText } from "@/components/ExpandableText";

export function AdminProjectDeals() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("DEAL_PENDING");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const q = filter === "ALL" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/projects${q}`, { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setDeals([]);
        setErr(
          (data && data.error) ||
            (res.status === 401 ? "Please login as admin" : "Failed to load deals")
        );
        return;
      }
      setDeals(Array.isArray(data) ? data : data?.projects || data?.deals || []);
    } catch {
      setDeals([]);
      setErr("Network error loading deals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function act(id: string, action: "ACCEPT" | "REJECT") {
    let rejectReason: string | undefined;
    if (action === "REJECT") {
      rejectReason =
        prompt("Reason for rejection (sent to client)") || "Not a fit at this time";
    }
    setBusy(id + action);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, rejectReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(data.message || (action === "ACCEPT" ? "Deal accepted" : "Deal rejected"));
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  const statusLabel = (s: string) =>
    String(s || "")
      .replace(/^DEAL_/, "")
      .replace(/_/g, " ");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            <Briefcase className="w-3.5 h-3.5 text-primary-600" />
            Pipeline
          </div>
          <h2 className="text-xl font-bold text-construction-dark">Project deals</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Client construction requests. Accept or reject — on accept, contact the client
            with the details below.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm min-h-[44px] bg-white"
        >
          <option value="DEAL_PENDING">Pending review</option>
          <option value="DEAL_ACCEPTED">Accepted</option>
          <option value="DEAL_REJECTED">Rejected</option>
          <option value="ALL">All deals</option>
        </select>
      </div>

      {msg && (
        <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
          {msg}
        </p>
      )}
      {err && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {err}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : deals.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-sm text-slate-500">
          No deals in this filter. Clients open deals from their dashboard → Project deal.
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((d) => (
            <div
              key={d.id}
              className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden"
            >
              <div className="px-4 sm:px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-construction-dark text-base">
                        {d.title || "Untitled deal"}
                      </h3>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          d.status === "DEAL_ACCEPTED"
                            ? "bg-emerald-100 text-emerald-800"
                            : d.status === "DEAL_REJECTED"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {statusLabel(d.status)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{formatDate(d.createdAt)}</span>
                      {d.budget != null && (
                        <span className="font-medium text-slate-700">
                          Budget {formatCurrency(d.budget)}
                        </span>
                      )}
                      {d.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {d.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {d.status === "DEAL_PENDING" && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => act(d.id, "ACCEPT")}
                        className="inline-flex items-center gap-1.5 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-3.5 rounded-xl disabled:opacity-50"
                      >
                        {busy === d.id + "ACCEPT" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => act(d.id, "REJECT")}
                        className="inline-flex items-center gap-1.5 min-h-[40px] bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-3.5 rounded-xl disabled:opacity-50"
                      >
                        {busy === d.id + "REJECT" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                {d.description && (
                  <div className="mt-3">
                    <ExpandableText text={d.description} limit={200} />
                  </div>
                )}

                <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
                  <p className="text-sm font-semibold text-construction-dark flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-primary-600" />
                    Client contact
                  </p>
                  <div className="grid sm:grid-cols-2 gap-2 text-sm">
                    <p>
                      <span className="text-slate-500">Name:</span>{" "}
                      {d.client?.name || "—"}
                    </p>
                    <p className="flex items-center gap-1.5 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {d.client?.email ? (
                        <a
                          className="text-primary-700 underline truncate"
                          href={`mailto:${d.client.email}`}
                        >
                          {d.client.email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {d.client?.phone ? (
                        <a
                          className="text-primary-700 underline"
                          href={`tel:${d.client.phone}`}
                        >
                          {d.client.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">No phone on profile</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      Verification: {d.client?.verificationStatus || "—"}
                      {d.client?.id && (
                        <>
                          {" · "}
                          <Link
                            href={`/admin/clients/${d.client.id}`}
                            className="text-primary-700 font-semibold hover:underline"
                          >
                            Open profile
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                  {d.status === "DEAL_ACCEPTED" && (
                    <p className="text-xs text-emerald-800 mt-2 font-medium">
                      Deal accepted — contact this client to schedule work.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
