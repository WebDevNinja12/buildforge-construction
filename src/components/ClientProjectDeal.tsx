"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Loader2, ClipboardList, CheckCircle2, XCircle, Clock } from "lucide-react";

export function ClientProjectDeal() {
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    budget: "",
    location: "",
    startDate: "",
    endDate: "",
    contactPhone: "",
    preferredContact: "phone",
  });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/projects");
      if (res.ok) setDeals(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          budget: Number(form.budget),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg({ type: "ok", text: data.message || "Deal submitted for review" });
      setForm({
        title: "",
        description: "",
        budget: "",
        location: "",
        startDate: "",
        endDate: "",
        contactPhone: "",
        preferredContact: "phone",
      });
      load();
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  function statusBadge(status: string) {
    if (status === "DEAL_ACCEPTED" || status === "PLANNING" || status === "IN_PROGRESS")
      return "bg-green-100 text-green-800";
    if (status === "DEAL_REJECTED") return "bg-red-100 text-red-800";
    if (status === "DEAL_PENDING") return "bg-amber-100 text-amber-800";
    return "bg-slate-100 text-slate-700";
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={submit} className="bg-white border rounded-2xl p-5 space-y-3 shadow-sm">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary-600" />
          Open a construction project deal
        </h3>
        <p className="text-sm text-slate-500">
          Describe your build. Admin will review and accept or reject. If accepted, Hama contacts you with the details on your account.
        </p>
        <input
          required
          placeholder="Project title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          required
          rows={4}
          placeholder="Describe the work (scope, materials, timeline expectations…)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="Site location"
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <input
          required
          type="number"
          min={0}
          placeholder="Estimated budget (USD)"
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            className="border rounded-lg px-2 py-2 text-sm"
          />
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className="border rounded-lg px-2 py-2 text-sm"
          />
        </div>
        <input
          placeholder="Best phone to reach you"
          value={form.contactPhone}
          onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={form.preferredContact}
          onChange={(e) => setForm({ ...form, preferredContact: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="phone">Prefer phone</option>
          <option value="email">Prefer email</option>
          <option value="whatsapp">Prefer WhatsApp</option>
          <option value="any">Any contact method</option>
        </select>
        {msg && (
          <p
            className={`text-sm rounded-lg px-3 py-2 ${
              msg.type === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
            {msg.text}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit deal for review
        </button>
      </form>

      <div className="bg-white border rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-lg mb-3">Your deals</h3>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
        ) : deals.length === 0 ? (
          <p className="text-sm text-slate-500">No deals yet.</p>
        ) : (
          <ul className="space-y-3 max-h-96 overflow-y-auto">
            {deals.map((d) => (
              <li key={d.id} className="border rounded-xl p-3">
                <div className="flex justify-between gap-2">
                  <p className="font-medium">{d.title}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusBadge(d.status)}`}>
                    {d.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{d.location} · {formatCurrency(d.budget)}</p>
                <p className="text-xs text-slate-400 mt-1">{formatDate(d.createdAt)}</p>
                {d.status === "DEAL_PENDING" && (
                  <p className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Waiting for admin review
                  </p>
                )}
                {d.status === "DEAL_ACCEPTED" && (
                  <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Accepted — expect a call/email from Hama
                  </p>
                )}
                {d.status === "DEAL_REJECTED" && (
                  <p className="text-xs text-red-700 mt-2 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Not accepted
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
