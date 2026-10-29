"use client";

import { LogOut } from "lucide-react";

export function LogoutButton({
  className = "",
  label = "Logout",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        title="Logout"
        aria-label="Logout"
        className={
          className ||
          "inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
        }
      >
        <LogOut className="w-4 h-4" />
        {label}
      </button>
    </form>
  );
}

/** Icon-only for compact UI */
export function LogoutIconButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        title="Logout"
        aria-label="Logout"
        className="inline-flex items-center justify-center p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </form>
  );
}
