"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Rental = {
  id: string;
  status: string;
  total?: number;
  endDate?: string | null;
  expiresAt?: string | null;
  tool?: { id: string; name: string; securityDeposit?: number | null } | null;
  user?: { id: string; name?: string | null; email?: string | null; phone?: string | null } | null;
};

export default function AdminToolReturnsPage() {
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState<Record<string, { condition: string; depositAction: string; notes: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tools?returns=1", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.rentals) ? data.rentals : [];
      setRentals(list);
      const next: typeof form = {};
      for (const r of list) {
        next[r.id] = form[r.id] || {
          condition: "Good",
          depositAction: "FULL_REFUND",
          notes: "",
        };
      }
      setForm(next);
    } catch {
      setRentals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function completeReturn(id: string) {
    const f = form[id] || { condition: "Good", depositAction: "FULL_REFUND", notes: "" };
    setBusy(id);
    setMsg("");
    try {
      const res = await fetch(`/api/tools/${id}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RETURN_COMPLETE",
          condition: f.condition,
          depositAction: f.depositAction,
          notes: f.notes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Return failed");
      setMsg(data.message || "Return completed — stock restocked");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Return failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-construction-dark flex items-center gap-2">
          <ClipboardCheck className="w-6 h-6 text-primary-600" />
          Tool returns
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Condition check, deposit handling, and restock when hire ends.
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{msg}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading active hires…
        </div>
      ) : rentals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No active tool hires awaiting return.
        </div>
      ) : (
        <div className="space-y-4">
          {rentals.map((r) => {
            const f = form[r.id] || { condition: "Good", depositAction: "FULL_REFUND", notes: "" };
            return (
              <div key={r.id} className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold text-construction-dark">{r.tool?.name || "Tool"}</p>
                    <p className="text-xs text-slate-500">
                      {r.user?.name || r.user?.email || "Client"} · status {r.status}
                      {r.user?.phone ? ` · ${r.user.phone}` : ""}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Total {formatCurrency(Number(r.total || 0))}
                      {r.tool?.securityDeposit
                        ? ` · Deposit ${formatCurrency(Number(r.tool.securityDeposit))}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 h-fit">
                    {r.status}
                  </span>
                </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="text-xs font-semibold text-slate-600 space-y-1">
                    Condition on return
                    <select
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm"
                      value={f.condition}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [r.id]: { ...f, condition: e.target.value },
                        }))
                      }
                    >
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Missing parts">Missing parts</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600 space-y-1">
                    Security deposit
                    <select
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm"
                      value={f.depositAction}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [r.id]: { ...f, depositAction: e.target.value },
                        }))
                      }
                    >
                      <option value="FULL_REFUND">Full refund</option>
                      <option value="PARTIAL_HOLD">Partial hold</option>
                      <option value="FORFEIT">Forfeit deposit</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600 space-y-1">
                    Notes
                    <input
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm"
                      value={f.notes}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [r.id]: { ...f, notes: e.target.value },
                        }))
                      }
                      placeholder="Optional"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => completeReturn(r.id)}
                  className="min-h-[44px] px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                  Complete return & restock
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
