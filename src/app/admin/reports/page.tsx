"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  FileText,
  Download,
  TrendingUp,
  Users,
  CalendarClock,
  CreditCard,
  BarChart3,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Period = "monthly" | "quarterly" | "annual";

type SeriesPoint = {
  key: string;
  label: string;
  revenue: number;
  paymentsApproved: number;
  paymentsPending: number;
  reservations: number;
  newClients: number;
};

async function downloadPdf(url: string, fallbackName: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let msg = "Download failed";
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {
      msg = `Download failed (${res.status})`;
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  if (!blob || blob.size < 50) throw new Error("Empty PDF file");
  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="?([^\x22;]+)"?/i);
  const name = match?.[1] || fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function BarChart({
  data,
  valueKey,
  color = "#2563eb",
}: {
  data: SeriesPoint[];
  valueKey: keyof SeriesPoint;
  color?: string;
}) {
  const values = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const w = 560;
  const h = 200;
  const pad = { top: 16, right: 12, bottom: 36, left: 48 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const gap = 6;
  const barW = Math.max(8, (innerW - gap * (data.length - 1)) / Math.max(data.length, 1));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.top + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.left} x2={w - pad.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400" fontSize={10}>
              {Math.round(max * t)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const bh = (v / max) * innerH;
        const x = pad.left + i * (barW + gap);
        const y = pad.top + innerH - bh;
        return (
          <g key={d.key}>
            <rect x={x} y={y} width={barW} height={Math.max(bh, v > 0 ? 2 : 0)} rx={4} fill={color} opacity={0.9}>
              <title>{d.label}: {v}</title>
            </rect>
            <text x={x + barW / 2} y={h - 12} textAnchor="middle" className="fill-slate-500" fontSize={10}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data }: { data: SeriesPoint[] }) {
  const values = data.map((d) => d.revenue);
  const max = Math.max(...values, 1);
  const w = 560;
  const h = 200;
  const pad = { top: 16, right: 12, bottom: 36, left: 48 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const points = data
    .map((d, i) => {
      const x = pad.left + i * step;
      const y = pad.top + innerH - (d.revenue / max) * innerH;
      return `${x},${y}`;
    })
    .join(" ");
  const area =
    data.length > 0
      ? `${pad.left},${pad.top + innerH} ${points} ${pad.left + (data.length - 1) * step},${pad.top + innerH}`
      : "";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
        const y = pad.top + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={pad.left} x2={w - pad.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" className="fill-slate-400" fontSize={10}>
              {formatCurrency(max * t)}
            </text>
          </g>
        );
      })}
      {area && <polygon points={area} fill="#2563eb" opacity={0.08} />}
      {points && (
        <polyline points={points} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      )}
      {data.map((d, i) => {
        const x = pad.left + i * step;
        const y = pad.top + innerH - (d.revenue / max) * innerH;
        return (
          <g key={d.key}>
            <circle cx={x} cy={y} r={3.5} fill="#2563eb" />
            <text x={x} y={h - 12} textAnchor="middle" className="fill-slate-500" fontSize={10}>
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function AdminReportsPage() {
  const now = new Date();
  const [period, setPeriod] = useState<Period>("monthly");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y, y - 1, y - 2, y - 3, y - 4];
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/reports?period=${period}&year=${year}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load charts");
      setSeries(Array.isArray(data.series) ? data.series : []);
      setTotals(data.totals || null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load");
      setSeries([]);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, [period, year]);

  useEffect(() => {
    load();
  }, [load]);

  function exportQuery(type: string) {
    const params = new URLSearchParams({ type, period, year: String(year) });
    if (period === "monthly") params.set("month", String(month));
    if (period === "quarterly") params.set("quarter", String(quarter));
    return `/api/admin/export?${params.toString()}`;
  }

  async function go(url: string, name: string) {
    setBusy(url);
    setMsg("");
    try {
      await downloadPdf(url, name);
      setMsg("Downloaded");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  const periodLabel =
    period === "monthly"
      ? new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" })
      : period === "quarterly"
        ? `Q${quarter} ${year}`
        : `Year ${year}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-construction-dark flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-primary-600" />
          Reports
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Revenue and activity charts, plus period PDF statements (monthly, quarterly, annual).
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report period</p>
        <div className="flex flex-wrap gap-2">
          {([
            ["monthly", "Monthly"],
            ["quarterly", "Quarterly"],
            ["annual", "Annual"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPeriod(id)}
              className={`min-h-[40px] px-4 rounded-xl text-sm font-semibold ${
                period === id
                  ? "bg-primary-600 text-white"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            <span className="block text-xs text-slate-500 mb-1">Year</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="min-h-[40px] border border-slate-200 rounded-xl px-3 text-sm bg-white"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          {period === "monthly" && (
            <label className="text-sm">
              <span className="block text-xs text-slate-500 mb-1">Month (for PDF)</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="min-h-[40px] border border-slate-200 rounded-xl px-3 text-sm bg-white"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1, 1).toLocaleString("en-US", { month: "long" })}
                  </option>
                ))}
              </select>
            </label>
          )}
          {period === "quarterly" && (
            <label className="text-sm">
              <span className="block text-xs text-slate-500 mb-1">Quarter (for PDF)</span>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
                className="min-h-[40px] border border-slate-200 rounded-xl px-3 text-sm bg-white"
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>Q{q}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Revenue", value: formatCurrency(totals?.revenue || 0), icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
              { label: "Approved payments", value: String(totals?.paymentsApproved || 0), icon: CreditCard, color: "text-primary-600 bg-primary-50" },
              { label: "Reservations", value: String(totals?.reservations || 0), icon: CalendarClock, color: "text-amber-700 bg-amber-50" },
              { label: "New clients", value: String(totals?.newClients || 0), icon: Users, color: "text-violet-600 bg-violet-50" },
            ].map((k) => (
              <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.color}`}>
                  <k.icon className="w-4 h-4" />
                </div>
                <p className="text-xs text-slate-500 mt-2">{k.label}</p>
                <p className="text-lg font-bold text-construction-dark mt-0.5">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-bold text-construction-dark mb-1">Revenue flow</h2>
              <p className="text-xs text-slate-500 mb-3">Approved payments · {period} view for {year}</p>
              {series.length ? <LineChart data={series} /> : <p className="text-sm text-slate-400 py-10 text-center">No data</p>}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-bold text-construction-dark mb-1">Reservations</h2>
              <p className="text-xs text-slate-500 mb-3">New holds created per bucket</p>
              {series.length ? <BarChart data={series} valueKey="reservations" color="#d97706" /> : <p className="text-sm text-slate-400 py-10 text-center">No data</p>}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-bold text-construction-dark mb-1">New clients</h2>
              <p className="text-xs text-slate-500 mb-3">Registrations over time</p>
              {series.length ? <BarChart data={series} valueKey="newClients" color="#7c3aed" /> : <p className="text-sm text-slate-400 py-10 text-center">No data</p>}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-bold text-construction-dark mb-1">Payment volume</h2>
              <p className="text-xs text-slate-500 mb-3">Count of approved payments</p>
              {series.length ? <BarChart data={series} valueKey="paymentsApproved" color="#2563eb" /> : <p className="text-sm text-slate-400 py-10 text-center">No data</p>}
            </div>
          </div>
        </>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div>
          <h2 className="text-sm font-bold text-construction-dark">Download period reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            PDF export for <strong>{periodLabel}</strong>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => go(exportQuery("overview"), `hama-statement-${period}-${year}.pdf`)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-primary-600 text-white px-4 py-2.5 rounded-xl disabled:opacity-50"
          >
            {busy.includes("overview") ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Overview statement PDF
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => go(exportQuery("clients"), `hama-clients-${period}-${year}.pdf`)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold border border-slate-200 bg-white px-4 py-2.5 rounded-xl disabled:opacity-50"
          >
            {busy.includes("clients") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Clients register PDF
          </button>
        </div>
        {msg && <p className="text-xs text-slate-500">{msg}</p>}
      </div>
    </div>
  );
}
