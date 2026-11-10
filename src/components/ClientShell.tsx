"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  Home,
} from "lucide-react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { LogoutMenuItem } from "@/components/LogoutMenuItem";
import { ToastProvider } from "@/components/Toast";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "My Profile", icon: User },
  { href: "/services", label: "Browse Services", icon: Building2 },
  { href: "/dashboard#reservations", label: "My Reservations", icon: CalendarClock },
  { href: "/dashboard#plans", label: "Installment Plans", icon: Layers },
  { href: "/dashboard#documents", label: "My Documents", icon: FileText },
  { href: "/dashboard#payments", label: "Payment History", icon: CreditCard },
  { href: "/quote", label: "Request Quote", icon: MessageSquare },
  { href: "/dashboard/finished-projects", label: "Finished Projects", icon: Sparkles },
];

const BOTTOM = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/services", label: "Services", icon: Building2 },
  { href: "/dashboard#plans", label: "Plans", icon: Layers },
  { href: "/profile", label: "Profile", icon: User },
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
  const [hash, setHash] = useState("");

  useEffect(() => {
    const sync = () => setHash((window.location.hash || "").replace(/^#/, "").toLowerCase());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  function active(href: string) {
    const [base, frag] = href.split("#");
    const path = pathname || "";
    if (frag) {
      if (path !== base && path !== base + "/") return false;
      const h = hash || "";
      if (frag === "reservations" || frag === "plans") {
        return h === "plans" || h === "reservations" || h === "reservation";
      }
      if (frag === "documents" || frag === "docs") return h === "documents" || h === "docs";
      if (frag === "payments") return h === "payments" || h === "payment";
      return h === frag.toLowerCase();
    }
    if (base === "/dashboard") {
      if (path !== "/dashboard" && path !== "/dashboard/") return false;
      return !hash || hash === "overview";
    }
    if (path === base) return true;
    if (path.startsWith(base + "/")) return true;
    return false;
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
            className={`flex items-center gap-3 min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-primary-50 hover:text-primary-800"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/"
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50"
      >
        <Home className="w-4 h-4" /> Public site
      </Link>
      <div className="pt-2 border-t mt-2">
        <LogoutMenuItem redirectTo="/login" />
      </div>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 flex overflow-x-hidden">
        <aside className="hidden lg:flex lg:w-64 flex-col bg-white border-r border-slate-200 fixed inset-y-0 left-0 z-20 shadow-sm">
          <div className="px-5 py-5 border-b bg-construction-dark text-white">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Hama" className="h-9 w-9 object-contain" />
              <div>
                <p className="font-bold tracking-wide leading-tight">Hama Construction</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Client portal</p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">{links}</div>
          <div className="p-4 border-t text-xs text-slate-500 truncate">{name}</div>
        </aside>

        <div className="fixed top-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-b px-4 h-14 flex items-center justify-between lg:left-64">
          <button
            type="button"
            className="lg:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200"
            onClick={() => setOpen(true)}
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="font-semibold text-construction-dark text-sm truncate">My account</p>
            {name && <p className="text-[11px] text-slate-500 truncate lg:hidden">{name}</p>}
          </div>
          <ProfileMenu name={name} profileHref="/profile" logoutRedirect="/login" />
        </div>

        {open && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute top-0 left-0 bottom-0 w-[min(20rem,88vw)] bg-white p-4 overflow-y-auto shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="font-bold text-construction-dark">Menu</p>
                  <p className="text-xs text-slate-500">{name}</p>
                </div>
                <button type="button" className="min-h-[44px] min-w-[44px]" onClick={() => setOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              {links}
            </div>
          </div>
        )}

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex justify-around px-1 py-1">
          {BOTTOM.map((item) => {
            const Icon = item.icon;
            const isActive = active(item.href);
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[52px] min-w-[64px] text-[10px] font-semibold ${
                  isActive ? "text-primary-600" : "text-slate-500"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 lg:ml-64 pt-14 pb-24 lg:pb-8 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
