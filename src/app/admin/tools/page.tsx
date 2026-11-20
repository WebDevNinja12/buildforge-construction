"use client";

import { useCallback, useEffect, useState } from "react";
import { Wrench, Plus, Loader2, Pencil, Trash2, Power } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Tool = {
  id: string;
  name: string;
  description: string;
  category: string;
  dailyRate: number;
  weeklyRate: number;
  securityDeposit?: number | null;
  minHireDays?: number | null;
  maxHireDays?: number | null;
  condition?: string | null;
  serialNumber?: string | null;
  quantity: number;
  available: number;
  image?: string | null;
  active: boolean;
};

const emptyForm = {
  name: "",
  description: "",
  category: "POWER_TOOLS",
  dailyRate: "",
  weeklyRate: "",
  securityDeposit: "0",
  minHireDays: "1",
  maxHireDays: "",
  condition: "Good",
  serialNumber: "",
  quantity: "1",
  image: "",
  active: true,
};

export default function AdminToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/tools", { credentials: "include" });
      if (res.status === 401 || res.status === 403) {
        setMsg("Admin session required");
        setTools([]);
        return;
      }
      const data = await res.json().catch(() => []);
      setTools(Array.isArray(data) ? data : []);
    } catch {
      setTools([]);
      setMsg("Failed to load tools");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMsg("");
  }

  function startEdit(t: Tool) {
    setEditId(t.id);
    setForm({
      name: t.name,
      description: t.description || "",
      category: t.category || "POWER_TOOLS",
      dailyRate: String(t.dailyRate ?? ""),
      weeklyRate: String(t.weeklyRate ?? ""),
      securityDeposit: String(t.securityDeposit ?? 0),
      minHireDays: String(t.minHireDays ?? 1),
      maxHireDays: t.maxHireDays != null ? String(t.maxHireDays) : "",
      condition: t.condition || "Good",
      serialNumber: t.serialNumber || "",
      quantity: String(t.quantity ?? 1),
      image: t.image || "",
      active: t.active !== false,
    });
    setShowForm(true);
    setMsg("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const payload = {
        id: editId || undefined,
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category,
        dailyRate: Number(form.dailyRate),
        weeklyRate: Number(form.weeklyRate),
        securityDeposit: Number(form.securityDeposit) || 0,
        minHireDays: Number(form.minHireDays) || 1,
        maxHireDays: form.maxHireDays ? Number(form.maxHireDays) : null,
        condition: form.condition || null,
        serialNumber: form.serialNumber || null,
        quantity: Math.max(1, Number(form.quantity) || 1),
        image: form.image || null,
        active: form.active,
      };
      if (!payload.name || !payload.description) throw new Error("Name and description are required");
      const res = await fetch("/api/admin/tools", {
        method: editId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg(editId ? "Tool updated" : "Tool created");
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t: Tool) {
    try {
      const res = await fetch("/api/admin/tools", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, active: !t.active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed");
      }
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function remove(t: Tool) {
    if (!confirm('Delete tool "' + t.name + '"? This cannot be undone.')) return;
    try {
      const res = await fetch("/api/admin/tools", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      setMsg("Tool deleted");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-construction-dark flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary-600" />
            Tools inventory
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage hire stock, rates, deposits, and availability.</p>
        </div>
        <button type="button" onClick={startCreate} className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold">
          <Plus className="w-4 h-4" /> Add tool
        </button>
      </div>

      {msg && <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{msg}</div>}

      {showForm && (
        <form onSubmit={save} className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-construction-dark">{editId ? "Edit tool" : "New tool"}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-600 space-y-1 sm:col-span-2">
              Name *
              <input required className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1 sm:col-span-2">
              Description *
              <textarea required rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1">
              Category
              <select className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                <option value="POWER_TOOLS">Power tools</option>
                <option value="HAND_TOOLS">Hand tools</option>
                <option value="HEAVY">Heavy equipment</option>
                <option value="SAFETY">Safety</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1">
              Quantity
              <input type="number" min={1} className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1">
              Daily rate (NGN)
              <input type="number" min={0} required className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm" value={form.dailyRate} onChange={(e) => setForm((f) => ({ ...f, dailyRate: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1">
              Weekly rate (NGN)
              <input type="number" min={0} required className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm" value={form.weeklyRate} onChange={(e) => setForm((f) => ({ ...f, weeklyRate: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1">
              Security deposit
              <input type="number" min={0} className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm" value={form.securityDeposit} onChange={(e) => setForm((f) => ({ ...f, securityDeposit: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1">
              Min hire days
              <input type="number" min={1} className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm" value={form.minHireDays} onChange={(e) => setForm((f) => ({ ...f, minHireDays: e.target.value }))} />
            </label>
            <label className="text-xs font-semibold text-slate-600 space-y-1 sm:col-span-2">
              Image URL (optional)
              <input className="w-full min-h-[42px] rounded-xl border border-slate-200 px-3 text-sm" placeholder="https://..." value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} />
            </label>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="rounded border-slate-300" />
            Active (visible for hire)
          </label>
          <div className="flex flex-wrap gap-2 pt-2">
            <button type="submit" disabled={saving} className="min-h-[44px] px-5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold disabled:opacity-50">
              {saving ? "Saving..." : editId ? "Update tool" : "Create tool"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="min-h-[44px] px-4 rounded-xl border border-slate-200 text-sm font-semibold">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading tools...
        </div>
      ) : tools.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No tools yet. Click <strong>Add tool</strong> to create inventory.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {tools.map((t) => (
            <div key={t.id} className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="aspect-video bg-slate-100 relative">
                {t.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Wrench className="w-10 h-10" />
                  </div>
                )}
                <span className={"absolute top-2 left-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full " + (t.active ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200")}>
                  {t.active ? "Active" : "Off"}
                </span>
              </div>
              <div className="p-4 space-y-3 flex-1 flex flex-col">
                <div>
                  <p className="font-semibold text-construction-dark">{t.name}</p>
                  <p className="text-[11px] text-slate-400 uppercase tracking-wide mt-0.5">{t.category}</p>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1">{t.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-slate-400">Day / Week</p>
                    <p className="font-semibold">{formatCurrency(t.dailyRate)} / {formatCurrency(t.weeklyRate)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-slate-400">Stock</p>
                    <p className="font-semibold">{t.available} / {t.quantity ?? t.available}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1 mt-auto">
                  <button type="button" onClick={() => startEdit(t)} className="inline-flex items-center gap-1 text-xs font-semibold px-3 min-h-[36px] rounded-lg border">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button type="button" onClick={() => toggleActive(t)} className="inline-flex items-center gap-1 text-xs font-semibold px-3 min-h-[36px] rounded-lg border">
                    <Power className="w-3.5 h-3.5" /> {t.active ? "Off" : "On"}
                  </button>
                  <button type="button" onClick={() => remove(t)} className="inline-flex items-center gap-1 text-xs font-semibold px-3 min-h-[36px] rounded-lg border border-red-100 text-red-700">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
