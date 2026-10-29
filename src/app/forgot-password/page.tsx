"use client";

import { useState } from "react";
import Link from "next/link";
import { HardHat, Mail, ArrowLeft, Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [hint, setHint] = useState("");
  const [resetUrl, setResetUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setDone(false);
    setHint("");
    setResetUrl("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setDone(true);
      if (data.hint) setHint(data.hint);
      if (data.resetUrl) setResetUrl(data.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-500 rounded-xl mb-4">
            <HardHat className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-construction-dark">Forgot password</h1>
          <p className="mt-2 text-construction-gray text-sm">
            Enter the email on your Hama Construction account. We will send a reset link if it exists.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-5"
        >
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}
          {done && (
            <div className="bg-green-50 text-green-800 text-sm px-4 py-3 rounded-lg space-y-2">
              <p>
                If an account exists for that email, password reset instructions have been sent.
                Check your inbox and spam folder. The link expires in 1 hour.
              </p>
              {hint && <p className="text-amber-800 text-xs">{hint}</p>}
              {resetUrl && (
                <p className="text-xs break-all">
                  Temporary link:{" "}
                  <a href={resetUrl} className="underline text-primary-700">
                    {resetUrl}
                  </a>
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Send reset link
          </button>

          <div className="flex flex-col sm:flex-row gap-2 justify-between text-sm pt-2">
            <Link href="/login" className="inline-flex items-center gap-1 text-primary-600 hover:underline">
              <ArrowLeft className="w-3.5 h-3.5" /> Client login
            </Link>
            <Link href="/admin/login" className="text-slate-500 hover:underline">
              Admin login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
