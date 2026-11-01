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
  { href: "/admin/services", label: "Services", icon: Building2 },
];

const MORE = [
  { href: "/admin/reservations", label: "Reservations", icon: CalendarClock },
  { href: "/admin/installments", label: "Installment Plans", icon: Layers },
  { href: "/admin/workers", label: "Workers", icon: HardHat },
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/cancellations", label: "Cancellations & Refunds", icon: RotateCcw },
  { href: "/admin/quotes", label: "Quotes", icon: MessageSquare },
  { href: "/admin/deals", label: "Project Deals", icon: Briefcase },
  { href: "/admin/scan", label: "Scan QR", icon: QrCode },
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
  const [drawer, setDrawer] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  function active(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const moreActive = MORE.some((m) => active(m.href));

  const sideNav = (
    <nav className="space-y-1">
      {ALL.map((item) => {
        const Icon = item.icon;
        const isActive = active(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawer(false)}
            className={`flex items-center gap-3 min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
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
      <div className="pt-2 border-t border-white/10 mt-2">
        <LogoutMenuItem
          redirectTo="/admin/login"
          className="w-full inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm font-medium text-red-300 hover:bg-white/10 rounded-xl"
        />
      </div>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-100 flex overflow-x-hidden">
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
          <div className="flex-1 overflow-y-auto px-3 py-4">{sideNav}</div>
        </aside>

        <div className="fixed top-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 lg:left-64 xl:left-72">
          <div className="h-14 px-4 flex items-center justify-between gap-3">
            <button
              type="button"
              className="lg:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <p className="font-semibold text-sm text-construction-dark truncate">Admin</p>
            <ProfileMenu name={name} profileHref="/profile" logoutRedirect="/admin/login" />
          </div>
        </div>

        {drawer && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
            <div className="absolute top-0 left-0 bottom-0 w-[min(20rem,88vw)] bg-construction-dark text-white p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold">Menu</span>
                <button type="button" className="min-h-[44px] min-w-[44px]" onClick={() => setDrawer(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              {sideNav}
            </div>
          </div>
        )}

        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-1 py-1 flex justify-around">
          {PRIMARY.map((item) => {
            const Icon = item.icon;
            const isActive = active(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 min-h-[52px] min-w-[56px] px-1 text-[10px] font-medium ${
                  isActive ? "text-primary-600" : "text-slate-500"
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[52px] min-w-[56px] px-1 text-[10px] font-medium ${
              moreActive ? "text-primary-600" : "text-slate-500"
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            More
          </button>
        </nav>

        {moreOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
            <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 max-h-[75vh] overflow-y-auto shadow-xl">
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3" />
              <p className="font-semibold text-sm mb-2">More</p>
              <div className="grid grid-cols-2 gap-2">
                {MORE.map((item) => {
                  const Icon = item.icon;
                  const isActive = active(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl text-sm border ${
                        isActive
                          ? "border-primary-300 bg-primary-50 text-primary-800"
                          : "border-slate-200 text-slate-700"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-3 border-t pt-2">
                <LogoutMenuItem redirectTo="/admin/login" />
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 lg:ml-64 xl:ml-72 pt-14 pb-24 lg:pb-8 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
