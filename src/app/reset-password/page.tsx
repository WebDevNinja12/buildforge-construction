"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HardHat, Eye, EyeOff, Loader2, Lock } from "lucide-react";

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loginPath, setLoginPath] = useState("/login");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!token) {
      setError("Missing reset token. Use the link from your email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword: confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setDone(true);
      setLoginPath(data.loginPath || "/login");
      setTimeout(() => router.push(data.loginPath || "/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="bg-white rounded-2xl border p-6 text-center space-y-3">
        <p className="text-sm text-red-700">Invalid reset link.</p>
        <Link href="/forgot-password" className="text-primary-600 underline text-sm">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-5"
    >
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}
      {done && (
        <div className="bg-green-50 text-green-800 text-sm px-4 py-3 rounded-lg">
          Password updated. Redirecting to sign in…
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type={show ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-label="Toggle password"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
        <input
          type={show ? "text" : "password"}
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading || done}
        className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Update password
      </button>

      <p className="text-center text-sm">
        <Link href={loginPath} className="text-primary-600 hover:underline">
          Back to login
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-slate-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-500 rounded-xl mb-4">
            <HardHat className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-construction-dark">Set new password</h1>
          <p className="mt-2 text-construction-gray text-sm">Choose a strong password for your account.</p>
        </div>
        <Suspense fallback={<p className="text-center text-sm text-slate-500">Loading…</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
