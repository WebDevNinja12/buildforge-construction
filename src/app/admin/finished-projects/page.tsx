"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, ImageIcon } from "lucide-react";
import { ImageUploadField } from "@/components/ImageUploadField";

interface FinishedProject {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  completedAt: string;
  imageUrl?: string | null;
  featured: boolean;
  sortOrder: number;
}

const emptyForm = {
  title: "",
  description: "",
  location: "",
  category: "RESIDENTIAL",
  completedAt: "",
  imageUrl: "",
  featured: true,
  sortOrder: 0,
};

export default function AdminFinishedProjectsPage() {
  const [projects, setProjects] = useState<FinishedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/finished-projects?all=1", { credentials: "include" });
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
    } catch {
      setError("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/finished-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setMessage("Project published");
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this finished project?")) return;
    try {
      const res = await fetch(`/api/finished-projects?id=${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      setMessage("Deleted");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-construction-dark">Finished projects</h1>
        <p className="text-sm text-slate-500 mt-1">
          Publish completed work to the home page and /projects. Admin only — clients cannot add
          projects.
        </p>
      </div>

      {message && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-2">
          {message}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4"
      >
        <p className="font-semibold text-construction-dark flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary-600" /> Add finished project
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Location *</label>
            <input
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description *</label>
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full border rounded-xl px-3 py-2.5 text-sm"
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
            >
              <option value="RESIDENTIAL">Residential</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="INFRASTRUCTURE">Infrastructure</option>
              <option value="HOTEL">Hotel</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Completed date *</label>
            <input
              required
              type="date"
              value={form.completedAt}
              onChange={(e) => setForm({ ...form, completedAt: e.target.value })}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Sort order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <ImageUploadField
          value={form.imageUrl}
          onChange={(url) => setForm({ ...form, imageUrl: url })}
          folder="finished-projects"
          label="Project image *"
          hint="Upload a clear photo of the completed project (JPEG, PNG, WebP)."
        />

        <button
          type="submit"
          disabled={saving || !form.imageUrl}
          className="min-h-[44px] px-5 rounded-xl bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white text-sm font-semibold"
        >
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Publishing…
            </span>
          ) : (
            "Publish project"
          )}
        </button>
        {!form.imageUrl && (
          <p className="text-xs text-amber-700">Add a project image before publishing.</p>
        )}
      </form>

      <div>
        <h2 className="font-bold text-construction-dark mb-3">Published projects</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          </div>
        ) : projects.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white border rounded-2xl p-5">None yet.</p>
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex gap-4 items-start shadow-sm"
              >
                <div className="w-24 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-construction-dark">{p.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.category} · {p.location}
                  </p>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{p.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="shrink-0 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-red-100 text-red-600 hover:bg-red-50"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
