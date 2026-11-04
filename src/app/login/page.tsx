"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HardHat, Eye, EyeOff, Loader2, User } from "lucide-react";

function ClientLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, portal: "client" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "USE_ADMIN_PORTAL") {
          setError("Administrators must sign in on the staff login page.");
          return;
        }
        setError(data.error || "Invalid email or password");
        return;
      }
      if (data.user?.role === "ADMIN") {
        setError("Administrators must sign in at the staff login page.");
        router.push("/admin/login");
        return;
      }
      router.push(data.redirect || next || "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 justify-center">
              <span className="bg-accent-500 p-2 rounded-xl">
                <HardHat className="w-6 h-6 text-white" />
              </span>
              <span className="text-xl font-bold text-construction-dark">
                Hama <span className="text-accent-500">Construction</span>
              </span>
            </Link>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-50 text-primary-800 text-xs font-semibold px-3 py-1">
              <User className="w-3.5 h-3.5" /> Client portal
            </div>
            <h1 className="mt-3 text-2xl font-bold text-construction-dark">Client sign in</h1>
            <p className="text-sm text-slate-500 mt-1">
              Reserve services, pay, and manage your projects
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4"
          >
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
                {error.includes("staff") && (
                  <Link href="/admin/login" className="block mt-1 font-semibold underline">
                    Go to staff login →
                  </Link>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none min-h-[44px]"
                placeholder="you@example.com"
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
                  className="w-full px-4 py-2.5 pr-11 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none min-h-[44px]"
                  placeholder="Your password"
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

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-primary-600 font-medium">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in
            </button>

            <p className="text-center text-sm text-slate-500">
              New client?{" "}
              <Link href="/register" className="text-primary-600 font-semibold">
                Create an account
              </Link>
            </p>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            Staff / administrator?{" "}
            <Link href="/admin/login" className="text-slate-600 underline">
              Use the staff login page
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      }
    >
      <ClientLoginForm />
    </Suspense>
  );
}
