"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { ImageUploadField } from "@/components/ImageUploadField";
import { formatCurrency } from "@/lib/utils";

const emptyForm = {
  name: "",
  specialty: "",
  experience: "",
  dailyRate: "",
  location: "",
  bio: "",
  skills: "",
  image: "",
};

export default function AdminWorkersPage() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/workers", { credentials: "include" });
      const data = await res.json().catch(() => []);
      setWorkers(Array.isArray(data) ? data : []);
    } catch {
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setErr("");
    try {
      const res = await fetch("/api/admin/workers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          specialty: form.specialty,
          experience: form.experience ? Number(form.experience) : 0,
          dailyRate: Number(form.dailyRate),
          location: form.location || null,
          bio: form.bio || null,
          skills: form.skills
            ? form.skills.split(",").map((s) => s.trim()).filter(Boolean)
            : null,
          image: form.image || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to add worker");
      setMsg(`Worker "${data.name || form.name}" added`);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove worker "${name}"? They will be hidden from clients.`)) return;
    try {
      const res = await fetch(`/api/admin/workers?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Remove failed");
      setMsg(`Worker "${name}" removed`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Remove failed");
    }
  }

  async function hardDelete(id: string, name: string) {
    if (
      !confirm(
        `Permanently delete "${name}"? This cannot be undone and will remove related hire records.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/admin/workers?id=${encodeURIComponent(id)}&hard=1`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      setMsg(`Worker "${name}" permanently deleted`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function reactivate(id: string) {
    try {
      const res = await fetch("/api/admin/workers", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    }
  }

  const visible = workers.filter((w) => (showInactive ? true : w.active !== false));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-construction-dark">Workers</h1>
          <p className="text-sm text-slate-500">Add, deactivate, or permanently remove worker profiles.</p>
        </div>
        <label className="text-xs flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      <form onSubmit={create} className="bg-white border rounded-2xl p-4 sm:p-5 space-y-3">
        <p className="font-semibold text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add worker
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            className="border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            placeholder="Profession / skill"
            value={form.specialty}
            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            required
          />
          <input
            className="border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            placeholder="Years of experience"
            type="number"
            min={0}
            value={form.experience}
            onChange={(e) => setForm({ ...form, experience: e.target.value })}
          />
          <input
            className="border rounded-xl px-3 py-2.5 text-sm min-h-[44px]"
            placeholder="Daily rate"
            type="number"
            min={0}
            step="0.01"
            value={form.dailyRate}
            onChange={(e) => setForm({ ...form, dailyRate: e.target.value })}
            required
          />
          <input
            className="border rounded-xl px-3 py-2.5 text-sm min-h-[44px] sm:col-span-2"
            placeholder="Location / address"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
          <input
            className="border rounded-xl px-3 py-2.5 text-sm min-h-[44px] sm:col-span-2"
            placeholder="Skills (comma separated)"
            value={form.skills}
            onChange={(e) => setForm({ ...form, skills: e.target.value })}
          />
        </div>
        <textarea
          className="border rounded-xl px-3 py-2.5 text-sm w-full"
          placeholder="Short bio / details"
          rows={3}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
        />
        <ImageUploadField
          label="Worker photo"
          folder="workers"
          value={form.image}
          onChange={(url) => setForm({ ...form, image: url })}
          circular
        />
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] px-4 rounded-xl bg-primary-600 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save worker
        </button>
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary-600" />
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">
          No workers yet. Add one using the form above.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {visible.map((w) => (
            <div
              key={w.id}
              className={`bg-white border rounded-2xl p-4 flex gap-3 ${
                w.active === false ? "opacity-60" : ""
              }`}
            >
              {w.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.image} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  <UserRound className="w-6 h-6 text-slate-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{w.name}</p>
                    <p className="text-xs text-slate-500">
                      {w.specialty}
                      {w.location ? ` · ${w.location}` : ""}
                    </p>
                    <p className="text-sm mt-1">
                      {formatCurrency(Number(w.dailyRate))}/day · {w.experience ?? 0}y exp
                    </p>
                    {w.active === false && (
                      <span className="text-[10px] font-semibold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {w.active === false ? (
                    <button
                      type="button"
                      className="text-xs font-semibold text-emerald-700 min-h-[36px] px-2"
                      onClick={() => reactivate(w.id)}
                    >
                      Reactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-600 min-h-[36px] px-2 inline-flex items-center gap-1"
                      onClick={() => remove(w.id, w.name)}
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-xs text-slate-500 min-h-[36px] px-2"
                    onClick={() => hardDelete(w.id, w.name)}
                  >
                    Delete forever
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
