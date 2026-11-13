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
  const [drawer, setDrawer] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  function active(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const pageTitle =
    ALL.find((i) => active(i.href))?.label ||
    (pathname.startsWith("/admin/clients/") ? "Client profile" : "Admin");

  const sideNav = (
    <nav className="space-y-0.5">
      {ALL.map((item) => {
        const Icon = item.icon;
        const isActive = active(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawer(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              isActive
                ? "bg-primary-50 text-primary-800"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary-600" : "text-slate-400"}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col border-r border-slate-200 bg-white z-30">
          <div className="h-16 flex items-center px-4 border-b border-slate-100">
            <Link href="/admin" className="flex items-center gap-2.5">
              <Shield className="w-6 h-6 text-primary-600" />
              <span className="font-bold text-construction-dark text-sm">Hama Admin</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto p-3">{sideNav}</div>
          <div className="p-3 border-t border-slate-100">
            <ProfileMenu name={name} />
            <LogoutMenuItem />
          </div>
        </aside>

        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="p-2 -ml-2 rounded-lg text-slate-600"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <p className="font-semibold text-sm text-construction-dark truncate">{pageTitle}</p>
          <ProfileMenu name={name} />
        </header>

        {/* Mobile drawer */}
        {drawer && (
          <div className="lg:hidden fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close"
              onClick={() => setDrawer(false)}
            />
            <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col">
              <div className="h-14 flex items-center justify-between px-4 border-b">
                <span className="font-bold text-sm">Menu</span>
                <button type="button" onClick={() => setDrawer(false)} className="p-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3">{sideNav}</div>
              <div className="p-3 border-t">
                <LogoutMenuItem />
              </div>
            </div>
          </div>
        )}

        {/* Bottom nav mobile */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-1 py-1 flex justify-around safe-pb">
          {PRIMARY.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = active(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-1 px-2 min-w-[56px] ${
                  isActive ? "text-primary-700" : "text-slate-400"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium truncate max-w-[64px]">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-0.5 py-1 px-2 min-w-[56px] text-slate-400"
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>

        {moreOpen && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/40 flex items-end">
            <button type="button" className="absolute inset-0" onClick={() => setMoreOpen(false)} aria-label="Close" />
            <div className="relative w-full bg-white rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">More</p>
              {[...PRIMARY.slice(4), ...MORE].map((item) => {
                const Icon = item.icon;
                const isActive = active(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium ${
                      isActive ? "bg-primary-50 text-primary-800" : "text-slate-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <main className="lg:pl-64 pb-20 lg:pb-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
