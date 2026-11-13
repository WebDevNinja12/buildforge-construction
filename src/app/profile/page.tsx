"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, Loader2, ArrowLeft, Save, LogOut, Mail, Phone, Shield } from "lucide-react";
import { ProfileAvatarUpload } from "@/components/ProfileAvatarUpload";
import { performLogout } from "@/components/LogoutMenuItem";

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
      setMsg(data.message || "Profile saved");
      if (data.avatarUrl !== undefined) {
        setForm((f) => ({ ...f, avatarUrl: data.avatarUrl || "" }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const initials = (form.name || form.email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-28 bg-gradient-to-b from-slate-100 to-slate-50 border-b border-slate-200/60" />

      <div className="max-w-md mx-auto px-4 -mt-16 pb-16">
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-primary-700 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => performLogout("/login")}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:border-red-100 transition shadow-sm"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={save}
          className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden"
        >
          <div className="px-6 pt-6 pb-2 text-center border-b border-slate-100">
            <div className="inline-flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
              <Shield className="w-3.5 h-3.5 text-primary-600" />
              Account
            </div>
            <h1 className="text-xl font-bold text-construction-dark tracking-tight">My profile</h1>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Update how your name and photo appear across the app
            </p>
          </div>

          <div className="px-6 py-6 space-y-6">
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                {error}
              </p>
            )}
            {msg && (
              <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
                {msg}
              </p>
            )}

            <ProfileAvatarUpload
              value={form.avatarUrl}
              onChange={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
              fallbackInitials={initials}
            />

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  <User className="w-3.5 h-3.5" />
                  Full name
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[48px] text-sm text-construction-dark focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition bg-white"
                  placeholder="Your full name"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </label>
                <input
                  value={form.email}
                  disabled
                  className="w-full border border-slate-100 rounded-xl px-3.5 py-2.5 min-h-[48px] text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Email is fixed for security. Contact support to change it.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  Phone
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 min-h-[48px] text-sm text-construction-dark focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition bg-white"
                  placeholder="+234…"
                  inputMode="tel"
                />
              </div>
            </div>

            <div className="pt-1 space-y-2.5">
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 min-h-[50px] shadow-sm transition"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save profile
              </button>

              <button
                type="button"
                onClick={() => performLogout("/login")}
                className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] border border-slate-200 text-slate-600 hover:border-red-200 hover:text-red-700 hover:bg-red-50/50 font-medium rounded-xl text-sm transition"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
