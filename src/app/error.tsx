"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 bg-slate-50">
      <div className="max-w-md w-full bg-white border rounded-2xl p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-construction-dark">Something went wrong</h1>
        <p className="text-sm text-slate-600 mt-2">
          Try again. If this keeps happening, go back to your dashboard.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold"
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl border text-sm font-semibold"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/admin"
            className="min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl border text-sm font-semibold text-slate-600"
          >
            Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
