"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Sparkles,
  LayoutDashboard,
  Users,
  Building2,
  CalendarClock,
  CreditCard,
  Layers,
  HardHat,
  Wrench,
  FileText,
  RotateCcw,
  MessageSquare,
  Briefcase,
  BarChart3,
  Settings,
  Activity,
  Menu,
  X,
  MoreHorizontal,
  Shield,
  QrCode,
} from "lucide-react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { LogoutMenuItem } from "@/components/LogoutMenuItem";
import { ToastProvider } from "@/components/Toast";

const PRIMARY = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/scan", label: "Scan QR", icon: QrCode },
  { href: "/admin/finished-projects", label: "Finished Projects", icon: Sparkles },
  { href: "/admin/services", label: "Services", icon: Building2 },
  { href: "/admin/tool-inventory", label: "Tools", icon: Wrench },
];

const MORE = [
  { href: "/admin/reservations", label: "Reservations", icon: CalendarClock },
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

const ALL = [...PRIMARY, ...MORE];

export function AdminShell({
  name,
  children,
}: {
  name?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  function active(href: string) {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/admin/tool-inventory") {
      return (
        pathname === "/admin/tool-inventory" ||
        pathname === "/admin/tools" ||
        pathname.startsWith("/admin/tool-inventory/") ||
        pathname.startsWith("/admin/tools/")
      );
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  const pageTitle = ALL.find((i) => active(i.href))?.label || "Admin";

  function go(href: string, e?: React.MouseEvent) {
    e?.preventDefault();
    setOpen(false);
    setMoreOpen(false);
    if (typeof window !== "undefined") {
      window.location.assign(href);
    }
  }

  function NavLink({ item }: { item: (typeof ALL)[0] }) {
    const Icon = item.icon;
    const isActive = active(item.href);
    return (
      <a
        href={item.href}
        onClick={(e) => go(item.href, e)}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
          isActive
            ? "bg-primary-600 text-white shadow-sm"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span>{item.label}</span>
      </a>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-100 flex">
        <aside className="hidden lg:flex lg:flex-col w-64 bg-construction-dark text-white shrink-0">
          <div className="p-4 border-b border-white/10">
            <Link href="/admin" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Hama" className="h-9 w-9 object-contain" />
              <div>
                <p className="font-bold text-sm tracking-wide leading-tight">Hama Construction</p>
                <p className="text-[11px] text-slate-400">Admin console</p>
              </div>
            </Link>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {PRIMARY.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
            <p className="text-[10px] uppercase tracking-wider text-slate-500 px-3 pt-4 pb-1">More</p>
            {MORE.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
          <div className="p-3 border-t border-white/10 text-xs text-slate-400 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            Staff session
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
            <div className="flex items-center justify-between gap-3 px-4 h-14">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
                  onClick={() => setOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <h1 className="font-semibold text-construction-dark truncate">{pageTitle}</h1>
              </div>
              <div className="flex items-center gap-2">
                <ProfileMenu name={name} />
                <LogoutMenuItem />
              </div>
            </div>
            <div className="lg:hidden flex gap-1 overflow-x-auto px-2 pb-2">
              {PRIMARY.map((item) => {
                const Icon = item.icon;
                const isActive = active(item.href);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={(e) => go(item.href, e)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                      isActive ? "bg-primary-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </a>
                );
              })}
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600"
              >
                <MoreHorizontal className="w-3.5 h-3.5" /> More
              </button>
            </div>
            {moreOpen && (
              <div className="lg:hidden px-3 pb-3 grid grid-cols-2 gap-1">
                {MORE.map((item) => {
                  const Icon = item.icon;
                  const isActive = active(item.href);
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={(e) => go(item.href, e)}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold ${
                        isActive ? "bg-primary-50 text-primary-800" : "bg-slate-50 text-slate-700"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span className="truncate">{item.label}</span>
                    </a>
                  );
                })}
              </div>
            )}
          </header>

          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Close" />
            <div className="absolute left-0 top-0 bottom-0 w-72 bg-construction-dark text-white p-3 overflow-y-auto">
              <div className="flex justify-between items-center mb-3">
                <p className="font-bold text-sm">Menu</p>
                <button type="button" onClick={() => setOpen(false)} className="p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {ALL.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
