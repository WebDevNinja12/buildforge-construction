"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PlanCard } from "@/components/PlanCard";
import { Loader2, Building2, Trash2 } from "lucide-react";

const TERMINAL = ["CANCELLED", "EXPIRED", "FULLY_PAID", "COMPLETED", "REFUNDED"];

type PlansMode = "all" | "reservations" | "installments";

function isInstallmentPlan(p: any) {
  const m = String(p?.paymentMethod || p?.paymentType || "").toUpperCase();
  return m === "INSTALLMENT";
}

function isTerminal(p: any) {
  return TERMINAL.includes(String(p?.status || "").toUpperCase());
}

export function DashboardPlans({ mode = "all" }: { mode?: PlansMode }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [res, hideRes] = await Promise.all([
        fetch("/api/reservations", { credentials: "include" }),
        fetch("/api/history/clear", { credentials: "include" }),
      ]);
      if (res.status === 401) {
        setError("Please log in again.");
        setPlans([]);
        return;
      }
      const data = await res.json().catch(() => []);
      setPlans(Array.isArray(data) ? data : []);
      if (hideRes.ok) {
        const h = await hideRes.json().catch(() => ({}));
        setHidden(new Set(Array.isArray(h.reservations) ? h.reservations.map(String) : []));
      }
    } catch {
      setError("Could not load this section. Pull to refresh or try again.");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const byMode = useMemo(() => {
    const base =
      mode === "installments"
        ? plans.filter(isInstallmentPlan)
        : mode === "reservations"
          ? plans.filter((p) => !isInstallmentPlan(p))
          : plans;
    return base.filter((p) => !hidden.has(String(p.id)));
  }, [plans, mode, hidden]);

  const visible = showAll ? byMode : byMode.filter((p) => !isTerminal(p));
  const selectable = visible.filter(isTerminal);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size >= selectable.length) setSelected(new Set());
    else setSelected(new Set(selectable.map((p) => String(p.id))));
  }

  async function cleanupSelected() {
    if (!selected.size) return;
    if (
      !confirm(
        `Remove ${selected.size} completed/cancelled item(s) from your history?\nActive bookings are not affected.`
      )
    )
      return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/history/clear", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationIds: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Cleanup failed");
      setMsg(data.message || "Removed from history");
      setSelected(new Set());
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Cleanup failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
        <p className="text-xs text-slate-500">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-sm text-amber-900">
        {error}
        <button type="button" onClick={load} className="block mt-2 font-semibold underline">
          Retry
        </button>
      </div>
    );
  }

  if (!byMode.length) {
    return (
      <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-8 text-center">
        <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="font-semibold text-construction-dark">
          {mode === "installments"
            ? "No installment plans yet"
            : mode === "reservations"
              ? "No reservations yet"
              : "No bookings yet"}
        </p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          {mode === "installments"
            ? "When you choose an installment plan on a reservation, it appears here with schedule and balance."
            : "Browse services, preview full details, then reserve. Full payment and hold countdown appear here."}
        </p>
        <Link
          href="/services"
          className="inline-flex items-center justify-center mt-4 min-h-[44px] px-5 rounded-xl bg-primary-600 text-white text-sm font-semibold"
        >
          Browse services
        </Link>
      </div>
    );
  }

  const title =
    mode === "installments"
      ? "Installment plans"
      : mode === "reservations"
        ? "Reservations"
        : "Plans & reservations";
  const subtitle =
    mode === "installments"
      ? "Active installment schedules, balances, and next due dates."
      : mode === "reservations"
        ? "Holds awaiting full payment or payment method selection. Installment plans are listed separately."
        : "All asset bookings.";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-construction-dark">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {visible.length} shown · {byMode.length} in this section
        </p>
        <button
          type="button"
          onClick={() => {
            setShowAll((v) => !v);
            setSelected(new Set());
          }}
          className="text-xs font-semibold text-primary-700 min-h-[40px] px-2"
        >
          {showAll ? "Hide completed / cancelled" : "Show all history"}
        </button>
      </div>
      {showAll && selectable.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 min-h-[36px]">
            <input
              type="checkbox"
              checked={selected.size > 0 && selected.size === selectable.length}
              onChange={toggleAll}
              className="rounded border-slate-300"
            />
            Select all history ({selectable.length})
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
        </div>
      )}
      {msg && (
        <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">{msg}</p>
      )}
      {visible.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border rounded-2xl p-5">
          No active items in this section. Cleared or completed items are hidden — use “Show all history”.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {visible.map((p) => {
            const term = isTerminal(p);
            const id = String(p.id);
            return (
              <div key={id} className="relative">
                {showAll && term && (
                  <label className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 bg-white/95 border border-slate-200 rounded-lg px-2 py-1 shadow-sm text-[10px] font-semibold text-slate-600">
                    <input
                      type="checkbox"
                      checked={selected.has(id)}
                      onChange={() => toggle(id)}
                      className="rounded border-slate-300"
                    />
                    Select
                  </label>
                )}
                <PlanCard plan={p} onUpdated={load} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
