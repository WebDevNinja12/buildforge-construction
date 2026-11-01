"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  User,
  Building2,
  CalendarClock,
  Layers,
  FileText,
  CreditCard,
  MessageSquare,
  Sparkles,
  Menu,
  X,
  LogOut,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "My Profile", icon: User },
  { href: "/services", label: "Browse Services", icon: Building2 },
  { href: "/dashboard#reservations", label: "My Reservations", icon: CalendarClock },
  { href: "/dashboard#plans", label: "My Installment Plans", icon: Layers },
  { href: "/dashboard#documents", label: "My Documents", icon: FileText },
  { href: "/dashboard#payments", label: "Payment History", icon: CreditCard },
  { href: "/quote", label: "Request Quote", icon: MessageSquare },
  { href: "/dashboard/finished-projects", label: "Finished Projects", icon: Sparkles },
  { href: "/quote", label: "Quotes", icon: MessageSquare },
];

export function ClientShell({
  name,
  children,
}: {
  name?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function active(href: string) {
    const base = href.split("#")[0];
    if (base === "/dashboard") return pathname === "/dashboard";
    return pathname === base || pathname.startsWith(base + "/");
  }

  const links = (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active(item.href);
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
              isActive
                ? "bg-primary-600 text-white"
                : "text-slate-600 hover:bg-primary-50 hover:text-primary-800"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="hidden lg:flex lg:w-64 flex-col bg-white border-r border-slate-200 fixed inset-y-0 left-0 z-20">
        <div className="px-5 py-5 border-b">
          <p className="font-bold text-construction-dark">Hama Construction</p>
          <p className="text-xs text-slate-500">Client portal</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{links}</div>
        <div className="p-4 border-t">
          <p className="text-xs text-slate-500 truncate mb-2">{name}</p>
          <button
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium border rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              window.location.href = "/login";
            }}
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 inset-x-0 z-30 bg-white border-b px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-construction-dark text-sm">My account</span>
        <button type="button" onClick={() => setOpen((v) => !v)} className="p-2 rounded-lg border">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-20">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute top-14 left-0 bottom-0 w-72 bg-white p-4 overflow-y-auto shadow-xl">
            {links}
            <button
              type="button"
              className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-medium border rounded-xl px-3 py-2"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                window.location.href = "/login";
              }}
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
