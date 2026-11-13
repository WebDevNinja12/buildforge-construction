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
  Menu,
  X,
  Home,
  Briefcase,
} from "lucide-react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { LogoutMenuItem } from "@/components/LogoutMenuItem";
import { ToastProvider } from "@/components/Toast";
import { NotificationBell } from "@/components/NotificationBell";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "My Profile", icon: User },
  { href: "/services", label: "Browse Services", icon: Building2 },
  { href: "/dashboard#reservations", label: "My Reservations", icon: CalendarClock },
  { href: "/dashboard#plans", label: "Installment Plans", icon: Layers },
  { href: "/dashboard#documents", label: "My Documents", icon: FileText },
  { href: "/dashboard#payments", label: "Payment History", icon: CreditCard },
  { href: "/dashboard#contracts", label: "My Contracts", icon: FileText },
  { href: "/dashboard#deal", label: "Project Deal", icon: Briefcase },
  { href: "/quote", label: "Request Quote", icon: MessageSquare },
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
    const sync = () =>
      setHash((window.location.hash || "").replace(/^#/, "").toLowerCase());
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
      if (frag === "reservations") return h === "reservations" || h === "reservation";
      if (frag === "plans") return h === "plans" || h === "installments" || h === "installment";
      if (frag === "documents") return h === "documents" || h === "docs";
      if (frag === "payments") return h === "payments";
      if (frag === "contracts") return h === "contracts";
      if (frag === "deal") return h === "deal" || h === "project";
      return h === frag;
    }
    if (base === "/dashboard") {
      if (path !== "/dashboard" && path !== "/dashboard/") return false;
      return !hash || hash === "overview";
    }
    if (path === base) return true;
    if (path.startsWith(base + "/")) return true;
    return false;
  }

  const pageTitle =
    NAV.find((i) => active(i.href))?.label ||
    (pathname?.startsWith("/profile") ? "My Profile" : "Client portal");

  const links = (
    <nav className="space-y-0.5">
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
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
            {item.label}
          </Link>
        );
      })}
      <div className="pt-3 mt-2 border-t border-slate-100 space-y-0.5">
        <Link
          href="/"
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          <Home className="w-4 h-4 text-slate-400" /> Public site
        </Link>
        <LogoutMenuItem redirectTo="/login" />
      </div>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
        <aside className="hidden lg:flex lg:w-64 flex-col bg-white border-r border-slate-200/90 fixed inset-y-0 left-0 z-20">
          <div className="px-5 py-5 border-b border-white/10 bg-construction-dark text-white">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Hama" className="h-9 w-9 object-contain rounded-lg bg-white/10 p-0.5" />
              <div className="min-w-0">
                <p className="font-bold tracking-wide leading-tight truncate">Hama Construction</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Client portal</p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">{links}</div>
          {name && (
            <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500 truncate">
              Signed in as <span className="font-medium text-slate-700">{name}</span>
            </div>
          )}
        </aside>

        <div className="fixed top-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90">
          <div className="h-14 px-3 sm:px-4 lg:pl-[calc(16rem+1rem)] lg:pr-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                className="lg:hidden min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl border border-slate-200 text-slate-600"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <p className="font-semibold text-construction-dark text-sm sm:text-base truncate">
                  {pageTitle}
                </p>
                {name && (
                  <p className="text-[11px] text-slate-500 truncate lg:hidden">{name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <NotificationBell />
              <ProfileMenu name={name} profileHref="/profile" logoutRedirect="/login" />
            </div>
          </div>
        </div>

        {open && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
            <div className="absolute top-0 left-0 bottom-0 w-[min(20rem,88vw)] bg-white shadow-2xl flex flex-col">
              <div className="px-4 py-4 border-b bg-construction-dark text-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="" className="h-8 w-8 object-contain rounded-md bg-white/10 p-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm truncate">Hama Construction</p>
                    <p className="text-[10px] text-slate-300 truncate">{name || "Client portal"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3">{links}</div>
            </div>
          </div>
        )}

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 flex justify-around px-1 py-1 safe-pb">
          {BOTTOM.map((item) => {
            const Icon = item.icon;
            const isActive = active(item.href);
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[52px] min-w-[64px] text-[10px] font-semibold transition-colors ${
                  isActive ? "text-primary-600" : "text-slate-500"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary-600" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1 lg:ml-64 pt-14 pb-24 lg:pb-10 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
