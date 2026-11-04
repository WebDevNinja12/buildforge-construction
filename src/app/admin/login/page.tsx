"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HardHat, Eye, EyeOff, Loader2, Shield } from "lucide-react";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Invalid email or password");
        return;
      }
      router.push(data.redirect || next || "/admin");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-construction-dark flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 justify-center">
              <span className="bg-accent-500 p-2 rounded-xl">
                <HardHat className="w-6 h-6 text-white" />
              </span>
              <span className="text-xl font-bold text-white">
                Hama <span className="text-accent-500">Construction</span>
              </span>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 text-accent-400 text-xs font-semibold px-3 py-1 border border-white/10">
              <Shield className="w-3.5 h-3.5" /> Staff only
            </div>
            <h1 className="mt-3 text-2xl font-bold text-white">Admin sign in</h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage clients, services, payments, and reservations
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="bg-white rounded-2xl shadow-xl p-6 space-y-4"
          >
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Admin email</label>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-accent-500 outline-none min-h-[44px]"
                placeholder="staff@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-300 focus:ring-2 focus:ring-accent-500 outline-none min-h-[44px]"
                  placeholder="Admin password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-construction-dark hover:bg-slate-800 text-white font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in to admin
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 mt-6">
            Client account?{" "}
            <Link href="/login" className="text-slate-300 underline">
              Use the client login page
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-construction-dark flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-500" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
