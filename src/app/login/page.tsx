"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  HardHat,
  Eye,
  EyeOff,
  Loader2,
  User,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldAlert,
} from "lucide-react";

const FALLBACK_RULES = [
  "Provide accurate personal or company information and valid supporting documents.",
  "Reservations are time-limited; pay before the hold expires or the listing is released.",
  "Installment plans follow the rules published per category; late payments may incur deductions.",
  "Do not misuse the platform, submit fraudulent documents, or share your account.",
  "Only the account holder (or authorized company contact) may manage bookings and payments.",
  "Hama Construction may suspend accounts that violate these rules pending review.",
];

function ClientLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendNote, setSuspendNote] = useState<string | null>(null);
  const [rules, setRules] = useState<string[]>(FALLBACK_RULES);

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
        if (data.code === "ACCOUNT_SUSPENDED" || data.status === "SUSPENDED") {
          setRules(Array.isArray(data.rules) && data.rules.length ? data.rules : FALLBACK_RULES);
          setSuspendNote(data.verificationNote || null);
          setSuspendOpen(true);
          setError("");
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

      {suspendOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="suspend-title"
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-red-600 text-white px-5 py-4 flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h2 id="suspend-title" className="font-bold text-lg">
                  Account suspended
                </h2>
                <p className="text-sm text-red-50 mt-1">
                  You cannot sign in because this account has been suspended for violating platform
                  rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSuspendOpen(false)}
                className="text-white/80 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto space-y-4">
              <div className="flex gap-2 items-start bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Rule violation</p>
                  <p className="mt-0.5">
                    {suspendNote
                      ? suspendNote
                      : "Our review found that one or more of the platform rules below were not followed. Access will stay blocked until an administrator lifts the suspension."}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-construction-dark mb-2">Platform rules</p>
                <ul className="space-y-2">
                  {rules.map((r) => (
                    <li key={r} className="flex gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-slate-500">
                If you believe this is a mistake, contact support with your registered email so we
                can review your case.
              </p>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
              <Link
                href="/terms"
                className="flex-1 min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Read full terms
              </Link>
              <button
                type="button"
                onClick={() => setSuspendOpen(false)}
                className="flex-1 min-h-[44px] rounded-xl bg-construction-dark text-white text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
