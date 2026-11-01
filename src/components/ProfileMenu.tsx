"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User, ChevronDown } from "lucide-react";
import { LogoutMenuItem } from "@/components/LogoutMenuItem";

export function ProfileMenu({
  name,
  profileHref = "/profile",
  logoutRedirect = "/login",
}: {
  name?: string;
  profileHref?: string;
  logoutRedirect?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
          <User className="w-4 h-4" />
        </span>
        <span className="hidden sm:inline max-w-[120px] truncate">{name || "Account"}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white shadow-lg py-1 z-50"
        >
          <Link
            href={profileHref}
            className="flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <User className="w-4 h-4" /> Profile
          </Link>
          <div className="border-t my-1" />
          <LogoutMenuItem redirectTo={logoutRedirect} />
        </div>
      )}
    </div>
  );
}
