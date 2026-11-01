"use client";

import { LogOut } from "lucide-react";

export async function performLogout(redirectTo = "/login") {
  const ok = window.confirm("Are you sure you want to log out?");
  if (!ok) return false;
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  } catch {
    /* still redirect */
  }
  // Clear any client leftovers
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* */
  }
  window.location.href = redirectTo;
  return true;
}

export function LogoutMenuItem({
  className = "",
  redirectTo = "/login",
  label = "Logout",
}: {
  className?: string;
  redirectTo?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={
        className ||
        "w-full inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 rounded-xl"
      }
      onClick={() => performLogout(redirectTo)}
    >
      <LogOut className="w-4 h-4" />
      {label}
    </button>
  );
}

export function LogoutButton({
  className = "",
  label = "Logout",
  redirectTo = "/login",
}: {
  className?: string;
  label?: string;
  redirectTo?: string;
}) {
  return (
    <button
      type="button"
      title="Logout"
      aria-label="Logout"
      className={
        className ||
        "inline-flex items-center justify-center gap-2 min-h-[44px] bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
      }
      onClick={() => performLogout(redirectTo)}
    >
      <LogOut className="w-4 h-4" />
      {label}
    </button>
  );
}

export function LogoutIconButton({ redirectTo = "/login" }: { redirectTo?: string }) {
  return (
    <button
      type="button"
      title="Logout"
      aria-label="Logout"
      className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-red-50 text-slate-700 hover:text-red-700"
      onClick={() => performLogout(redirectTo)}
    >
      <LogOut className="w-5 h-5" />
    </button>
  );
}
