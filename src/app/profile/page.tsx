"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, Loader2, ArrowLeft, Save } from "lucide-react";
import { ImageUploadField } from "@/components/ImageUploadField";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    avatarUrl: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load");
        setForm({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          avatarUrl: data.avatarUrl || "",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          avatarUrl: form.avatarUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMsg(data.message || "Saved");
      if (data.avatarUrl) setForm((f) => ({ ...f, avatarUrl: data.avatarUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-lg mx-auto px-4 py-10">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-primary-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-construction-dark flex items-center gap-2 mb-6">
          <User className="w-7 h-7 text-primary-600" /> My profile
        </h1>

        <form onSubmit={save} className="bg-white border rounded-2xl p-6 space-y-5 shadow-sm">
          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          {msg && <p className="text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{msg}</p>}

          <ImageUploadField
            label="Profile photo"
            folder="avatar"
            value={form.avatarUrl}
            onChange={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
            hint="Choose a clear photo from your device (JPEG/PNG, max 8MB)."
          />

          <div>
            <label className="text-sm font-medium text-slate-700">Full name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input value={form.email} disabled className="mt-1 w-full border rounded-lg px-3 py-2 bg-slate-50 text-slate-500" />
            <p className="text-xs text-slate-400 mt-1">Email cannot be changed here.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full border rounded-lg px-3 py-2"
              placeholder="+234…"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save profile
          </button>
        </form>
      </div>
    </div>
  );
}
