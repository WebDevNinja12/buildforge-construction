"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, CheckSquare, Square } from "lucide-react";
import { MultiImageUpload } from "@/components/ImageUploadField";
import { formatCurrency } from "@/lib/utils";

export default function AdminServicesPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "HOUSE",
    price: "",
    location: "",
    reservationHours: "",
  });
  const [images, setImages] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/assets?all=1", { credentials: "include" });
      const data = await res.json().catch(() => []);
      setAssets(Array.isArray(data) ? data : []);
      setSelected(new Set());
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const allIds = useMemo(() => assets.map((a) => a.id as string), [assets]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          reservationHours: form.reservationHours ? Number(form.reservationHours) : null,
          images,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || "Failed to save service");
      setMsg("Service added");
      setForm({
        title: "",
        description: "",
        type: "HOUSE",
        price: "",
        location: "",
        reservationHours: "",
      });
      setImages([]);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeOne(id: string) {
    if (!confirm("Delete this service?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/assets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setMsg("Service deleted");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!someSelected) return;
    if (!confirm(`Delete ${selected.size} selected service(s)? This cannot be undone.`)) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/assets", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setMsg(`Deleted ${data.deleted ?? selected.size} service(s)`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!assets.length) return;
    if (
      !confirm(
        `Clear ALL ${assets.length} services? Related reservations and payments for these services will be removed. This cannot be undone.`
      )
    )
      return;
    const typed = window.prompt('Type CLEAR ALL to confirm');
    if (typed !== "CLEAR ALL") {
      alert("Cancelled — confirmation text did not match.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/assets?all=1", {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Clear failed");
      setMsg(`Cleared ${data.deleted ?? 0} service(s)`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-construction-dark">Services</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!someSelected || busy}
            onClick={deleteSelected}
            className="min-h-[44px] px-3 rounded-xl border border-red-200 text-red-700 text-sm font-semibold disabled:opacity-40 inline-flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" />
            Delete selected ({selected.size})
          </button>
          <button
            type="button"
            disabled={!assets.length || busy}
            onClick={clearAll}
            className="min-h-[44px] px-3 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            Clear all
          </button>
        </div>
      </div>

      <form onSubmit={create} className="bg-white border rounded-2xl p-4 sm:p-5 space-y-3">
        <p className="font-semibold text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add service
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="border rounded-xl px-3 py-2 text-sm"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <input
            className="border rounded-xl px-3 py-2 text-sm"
            placeholder="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            required
          />
          <select
            className="border rounded-xl px-3 py-2 text-sm"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {["HOUSE", "HOTEL", "LAND", "APARTMENT", "COMMERCIAL", "BUILDING"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            className="border rounded-xl px-3 py-2 text-sm"
            placeholder="Price"
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          <input
            className="border rounded-xl px-3 py-2 text-sm sm:col-span-2"
            placeholder="Reservation hold (hours)"
            type="number"
            value={form.reservationHours}
            onChange={(e) => setForm({ ...form, reservationHours: e.target.value })}
          />
        </div>
        <textarea
          className="border rounded-xl px-3 py-2 text-sm w-full"
          placeholder="Description"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          required
        />
        <MultiImageUpload urls={images} value={images} onChange={setImages} />
        <button
          type="submit"
          disabled={saving}
          className="bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 min-h-[44px]"
        >
          {saving ? "Saving…" : "Save service"}
        </button>
        {msg && <p className="text-sm text-slate-600">{msg}</p>}
      </form>

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-600" />
      ) : assets.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No services yet. Add one above.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="button"
              onClick={toggleAll}
              className="min-h-[40px] inline-flex items-center gap-2 font-semibold text-construction-dark"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-primary-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {allSelected ? "Unselect all" : "Select all"}
            </button>
            <span className="text-slate-500">
              {selected.size} of {assets.length} selected
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {assets.map((a) => {
              const isOn = selected.has(a.id);
              return (
                <div
                  key={a.id}
                  className={`bg-white border rounded-2xl p-4 flex gap-3 ${
                    isOn ? "ring-2 ring-primary-500 border-primary-300" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="shrink-0 mt-1 min-h-[44px] min-w-[44px] flex items-start justify-center"
                    onClick={() => toggleOne(a.id)}
                    aria-label={isOn ? "Unselect" : "Select"}
                  >
                    {isOn ? (
                      <CheckSquare className="w-5 h-5 text-primary-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{a.title}</p>
                        <p className="text-xs text-slate-500">
                          {a.type} · {a.status}
                        </p>
                        <p className="text-sm font-medium text-accent-600 mt-1">
                          {formatCurrency(Number(a.price))}
                        </p>
                        {a.location && (
                          <p className="text-xs text-slate-500 mt-0.5">{a.location}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-xs text-red-600 shrink-0 min-h-[44px] px-2"
                        disabled={busy}
                        onClick={() => removeOne(a.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
