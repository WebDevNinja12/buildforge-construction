"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarClock,
  CreditCard,
  Layers,
  HardHat,
  FileText,
  RotateCcw,
  MessageSquare,
  Briefcase,
  BarChart3,
  Settings,
  Activity,
  Menu,
  X,
  LogOut,
  Shield,
} from "lucide-react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/services", label: "Services", icon: Building2 },
  { href: "/admin/reservations", label: "Reservations", icon: CalendarClock },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/installments", label: "Installment Plans", icon: Layers },
  { href: "/admin/workers", label: "Workers", icon: HardHat },
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/cancellations", label: "Cancellations & Refunds", icon: RotateCcw },
  { href: "/admin/quotes", label: "Quotes", icon: MessageSquare },
  { href: "/admin/deals", label: "Project Deals", icon: Briefcase },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/activity", label: "Activity Log", icon: Activity },
];

export function AdminShell({
  name,
  children,
}: {
  name?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function active(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const NavLinks = (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 xl:w-72 flex-col bg-construction-dark text-white fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent-400" />
            <div>
              <p className="font-bold text-sm tracking-wide">Hama Construction</p>
              <p className="text-[11px] text-slate-400">Admin console</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{NavLinks}</div>
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-slate-400 truncate mb-2">{name || "Admin"}</p>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium bg-white/10 hover:bg-white/15 rounded-xl px-3 py-2"
              onClick={async (e) => {
                e.preventDefault();
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                window.location.href = "/admin/login";
              }}
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-40 bg-construction-dark text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent-400" />
          <span className="font-semibold text-sm">Admin</span>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="p-2 rounded-lg hover:bg-white/10">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute top-14 left-0 bottom-0 w-72 bg-construction-dark p-4 overflow-y-auto">
            {NavLinks}
            <button
              type="button"
              className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-medium bg-white/10 rounded-xl px-3 py-2 text-white"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                window.location.href = "/admin/login";
              }}
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom nav (primary) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-1 py-1 flex justify-around">
        {[
          NAV[0],
          NAV[1],
          NAV[2],
          NAV[4],
          NAV[11],
        ].map((item) => {
          const Icon = item.icon;
          const isActive = active(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium ${
                isActive ? "text-primary-600" : "text-slate-500"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 lg:ml-64 xl:ml-72 pt-14 pb-20 lg:pt-0 lg:pb-0 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
