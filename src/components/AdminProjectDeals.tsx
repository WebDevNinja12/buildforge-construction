"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Loader2, Phone, Mail, CheckCircle2, XCircle, User } from "lucide-react";

export function AdminProjectDeals() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("DEAL_PENDING");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const q = filter === "ALL" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetch(`/api/projects${q}`);
      if (res.ok) setDeals(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function act(id: string, action: "ACCEPT" | "REJECT") {
    let rejectReason: string | undefined;
    if (action === "REJECT") {
      rejectReason = prompt("Reason for rejection (sent to client)") || "Not a fit at this time";
    }
    setBusy(id + action);
    setMsg("");
    try {
      const res = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(data.message || "Done");
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <h2 className="text-lg font-bold">Project deals (client requests)</h2>
          <p className="text-sm text-slate-500">
            Accept or reject. On accept, use the client contact details below to connect.
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="DEAL_PENDING">Pending review</option>
          <option value="DEAL_ACCEPTED">Accepted</option>
          <option value="DEAL_REJECTED">Rejected</option>
          <option value="ALL">All projects</option>
        </select>
      </div>

      {msg && <p className="text-sm bg-slate-50 border rounded-lg px-3 py-2">{msg}</p>}

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      ) : deals.length === 0 ? (
        <p className="text-sm text-slate-500">No deals in this filter.</p>
      ) : (
        <div className="space-y-4">
          {deals.map((d) => (
            <div key={d.id} className="border rounded-2xl p-4 bg-white shadow-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <div>
                  <p className="font-semibold text-lg">{d.title}</p>
                  <p className="text-sm text-slate-500">
                    {d.location} · Budget {formatCurrency(d.budget)} · {formatDate(d.createdAt)}
                  </p>
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-slate-100">
                    {d.status.replace(/_/g, " ")}
                  </span>
                </div>
                {d.status === "DEAL_PENDING" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => act(d.id, "ACCEPT")}
                      className="inline-flex items-center gap-1 bg-green-600 text-white text-sm font-semibold px-3 py-2 rounded-xl"
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
                      className="inline-flex items-center gap-1 bg-red-600 text-white text-sm font-semibold px-3 py-2 rounded-xl"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                )}
              </div>

              <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{d.description}</p>

              {/* Work / contact form — admin uses this after accept */}
              <div className="mt-4 bg-primary-50 border border-primary-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-primary-900 flex items-center gap-2 mb-2">
                  <User className="w-4 h-4" /> Client contact (use after accept)
                </p>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <p>
                    <span className="text-slate-500">Name:</span> {d.client?.name || "—"}
                  </p>
                  <p className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <a className="text-primary-700 underline" href={`mailto:${d.client?.email}`}>
                      {d.client?.email}
                    </a>
                  </p>
                  <p className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {d.client?.phone ? (
                      <a className="text-primary-700 underline" href={`tel:${d.client.phone}`}>
                        {d.client.phone}
                      </a>
                    ) : (
                      <span className="text-slate-400">No phone on profile</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    Verification: {d.client?.verificationStatus || "—"}
                  </p>
                </div>
                {d.status === "DEAL_ACCEPTED" && (
                  <p className="text-xs text-green-800 mt-2 font-medium">
                    Deal accepted — contact this client to schedule work.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
