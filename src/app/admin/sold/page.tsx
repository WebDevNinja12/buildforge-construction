"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Archive, RotateCcw, ShoppingBag } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type Asset = {
  id: string;
  title: string;
  type?: string;
  price: number;
  status: string;
  location?: string;
  updatedAt?: string;
};

export default function AdminSoldPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [reopenPrice, setReopenPrice] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/assets/lifecycle", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setAssets(Array.isArray(data.assets) ? data.assets : []);
      else setMsg(data.error || "Failed to load");
    } catch {
      setMsg("Failed to load sold assets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: "ARCHIVE" | "REOPEN", assetId: string) {
    setBusy(assetId + action);
    setMsg("");
    try {
      const body: Record<string, unknown> = { action, assetId };
      if (action === "REOPEN" && reopenPrice[assetId]) {
        body.price = Number(reopenPrice[assetId]);
      }
      const res = await fetch("/api/admin/assets/lifecycle", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(action === "ARCHIVE" ? "Archived" : "Reopened for sale");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-construction-dark flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-primary-600" />
          Sold & archived
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Fully paid sale assets. Archive to remove from ops view, or reopen for a new listing cycle
          (Super-Admin may be required).
        </p>
      </div>

      {msg && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">{msg}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No sold or archived assets yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {assets.map((a) => (
            <li
              key={a.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold text-construction-dark truncate">{a.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {a.type} · {formatCurrency(a.price)}
                  {a.location ? ` · ${a.location}` : ""}
                  {a.updatedAt ? ` · ${formatDate(a.updatedAt)}` : ""}
                </p>
                <span className="inline-block mt-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {a.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {String(a.status).toUpperCase() === "SOLD" && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => run("ARCHIVE", a.id)}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-200 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50"
                  >
                    <Archive className="w-4 h-4" />
                    Archive
                  </button>
                )}
                <input
                  type="number"
                  placeholder="New price"
                  className="w-28 min-h-[40px] rounded-xl border border-slate-200 px-2 text-sm"
                  value={reopenPrice[a.id] || ""}
                  onChange={(e) => setReopenPrice((p) => ({ ...p, [a.id]: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => {
                    if (!confirm("Reopen this asset for public sale?")) return;
                    run("REOPEN", a.id);
                  }}
                  className="min-h-[40px] px-3 rounded-xl bg-primary-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-primary-700 disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reopen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
