"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { MultiImageUpload } from "@/components/ImageUploadField";
import { formatCurrency } from "@/lib/utils";

export default function AdminServicesPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
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
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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

  async function remove(id: string) {
    if (!confirm("Delete this service?")) return;
    try {
      const res = await fetch(`/api/assets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Delete failed");
        return;
      }
      await load();
    } catch {
      alert("Delete failed");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-construction-dark">Services</h1>

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
        <div className="grid sm:grid-cols-2 gap-3">
          {assets.map((a) => (
            <div key={a.id} className="bg-white border rounded-2xl p-4">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{a.title}</p>
                  <p className="text-xs text-slate-500">
                    {a.type} · {a.status}
                  </p>
                  <p className="text-sm font-medium text-accent-600 mt-1">
                    {formatCurrency(Number(a.price))}
                  </p>
                  {a.location && <p className="text-xs text-slate-500 mt-0.5">{a.location}</p>}
                </div>
                <button
                  type="button"
                  className="text-xs text-red-600 shrink-0 min-h-[44px] px-2"
                  onClick={() => remove(a.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
