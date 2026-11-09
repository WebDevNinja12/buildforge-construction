"use client";

import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

type Props = {
  open: boolean;
  message: string;
  title?: string;
  onClose: () => void;
};

export function MaintenanceModal({
  open,
  message,
  title = "Site under maintenance",
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="maintenance-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="maintenance-title" className="text-lg font-bold text-construction-dark">
              {title}
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
              {message ||
                "Login and new account registration are temporarily unavailable. Please try again later."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
          <Link
            href="/"
            className="flex-1 min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Back to home
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
          >
            OK, I understand
          </button>
        </div>
      </div>
    </div>
  );
}
