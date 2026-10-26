"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react";

interface FinishedProject {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  completedAt: string;
  featured: boolean;
  sortOrder: number;
}

const emptyForm = {
  title: "",
  description: "",
  location: "",
  category: "RESIDENTIAL",
  completedAt: "",
  featured: true,
  sortOrder: 0,
};

export default function ManageFinishedProjectsPage() {
  const [projects, setProjects] = useState<FinishedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/finished-projects");
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
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      setMessage("Project added");
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
      const res = await fetch(`/api/finished-projects?id=${id}`, { method: "DELETE" });
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
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </Link>
        <h1 className="text-3xl font-bold text-construction-dark">Manage Finished Projects</h1>
        <p className="mt-1 text-construction-gray text-sm">
          Add or remove projects shown on the home page and /projects. Admin only.
        </p>

        {message && <p className="mt-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>}

        <form onSubmit={handleCreate} className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-semibold text-construction-dark flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add finished project
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location *</label>
              <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
            <textarea required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500">
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="INDUSTRIAL">Industrial</option>
                <option value="INFRASTRUCTURE">Infrastructure</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Completed date *</label>
              <input type="date" required value={form.completedAt} onChange={(e) => setForm({ ...form, completedAt: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sort order</label>
              <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
            {saving ? "Saving..." : "Publish project"}
          </button>
        </form>

        <div className="mt-10">
          <h2 className="font-semibold text-construction-dark mb-4">Published projects</h2>
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          ) : projects.length === 0 ? (
            <p className="text-sm text-construction-gray">None yet.</p>
          ) : (
            <ul className="space-y-3">
              {projects.map((p) => (
                <li key={p.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex justify-between items-start gap-3">
                  <div>
                    <p className="font-medium text-construction-dark">{p.title}</p>
                    <p className="text-sm text-slate-500">{p.location} · {p.category}</p>
                  </div>
                  <button type="button" onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-700 p-1" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
