"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  HardHat,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Lock,
  Building2,
  Users,
  CreditCard,
  CheckCircle2,
} from "lucide-react";

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
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-950">
      {/* Brand panel */}
      <aside className="relative lg:w-[48%] xl:w-[46%] overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(249,115,22,0.35), transparent 40%), radial-gradient(circle at 80% 80%, rgba(37,99,235,0.25), transparent 45%)",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between min-h-[220px] lg:min-h-screen p-6 sm:p-10 xl:p-14">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <span className="bg-accent-500 p-2 rounded-xl shadow-lg shadow-accent-500/30 group-hover:bg-accent-400 transition-colors">
                <HardHat className="w-6 h-6 text-white" />
              </span>
              <span className="text-lg font-bold tracking-tight">
                Hama <span className="text-accent-400">Construction</span>
              </span>
            </Link>

            <div className="mt-10 lg:mt-16 max-w-md">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1 text-xs font-semibold text-accent-300">
                <Shield className="w-3.5 h-3.5" />
                Secure staff access
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                Admin console
              </h1>
              <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
                Sign in to manage clients, services, payments, reservations, and project deals.
              </p>
              <p className="mt-2 text-xs text-slate-500 italic">
                Building innovation through quality and trust.
              </p>
            </div>
          </div>

          <ul className="hidden lg:grid grid-cols-1 gap-3 mt-12 max-w-md">
            {[
              { icon: Users, text: "Client verification & documents" },
              { icon: Building2, text: "Services, tools & workers" },
              { icon: CreditCard, text: "Payments & installment plans" },
            ].map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-slate-200"
              >
                <span className="bg-accent-500/20 text-accent-400 p-2 rounded-lg">
                  <Icon className="w-4 h-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>

          <p className="hidden lg:block text-[11px] text-slate-500 mt-10">
            © {new Date().getFullYear()} Hama Construction · Staff portal
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14 bg-slate-50">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-accent-400 text-xs font-semibold px-3 py-1">
              <Shield className="w-3.5 h-3.5" /> Staff only
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xl shadow-slate-200/60 p-6 sm:p-8">
            <div className="flex items-start gap-3 mb-6">
              <span className="bg-slate-900 text-accent-400 p-2.5 rounded-2xl shrink-0">
                <Lock className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Admin sign in</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Use your staff email and password
                </p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3"
                >
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Staff email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none min-h-[48px] transition"
                  placeholder="hamaconstruction01@gmail.com"
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none min-h-[48px] transition"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
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
                className="w-full min-h-[52px] rounded-xl bg-accent-500 hover:bg-accent-600 active:bg-accent-700 text-white font-semibold shadow-lg shadow-accent-500/25 disabled:opacity-60 inline-flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Sign in to admin
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
              <p className="text-xs text-slate-500 flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
                This portal is for authorized staff only. All actions are logged.
              </p>
              <p className="text-sm text-slate-600 text-center">
                Client account?{" "}
                <Link href="/login" className="text-primary-600 font-semibold hover:underline">
                  Client login
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-[11px] text-slate-400 mt-6 lg:hidden">
            © {new Date().getFullYear()} Hama Construction
          </p>
        </div>
      </main>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent-500" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
