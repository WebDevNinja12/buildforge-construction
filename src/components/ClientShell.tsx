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
} from "lucide-react";
import { ProfileMenu } from "@/components/ProfileMenu";
import { LogoutMenuItem } from "@/components/LogoutMenuItem";
import { ToastProvider } from "@/components/Toast";

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
            className={`flex items-center gap-3 min-h-[44px] px-3 py-2.5 rounded-xl text-sm font-medium ${
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
      <div className="pt-2 border-t mt-2">
        <LogoutMenuItem redirectTo="/login" />
      </div>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex overflow-x-hidden">
        <aside className="hidden lg:flex lg:w-64 flex-col bg-white border-r border-slate-200 fixed inset-y-0 left-0 z-20">
          <div className="px-5 py-5 border-b">
            <p className="font-bold text-construction-dark">Hama Construction</p>
            <p className="text-xs text-slate-500">Client portal</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">{links}</div>
        </aside>

        <div className="fixed top-0 inset-x-0 z-30 bg-white border-b px-4 h-14 flex items-center justify-between lg:left-64">
          <button
            type="button"
            className="lg:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border"
            onClick={() => setOpen(true)}
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-semibold text-construction-dark text-sm">My account</span>
          <ProfileMenu name={name} profileHref="/profile" logoutRedirect="/login" />
        </div>

        {open && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute top-0 left-0 bottom-0 w-[min(20rem,88vw)] bg-white p-4 overflow-y-auto shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold">Menu</span>
                <button type="button" className="min-h-[44px] min-w-[44px]" onClick={() => setOpen(false)}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              {links}
            </div>
          </div>
        )}

        <main className="flex-1 lg:ml-64 pt-14 min-h-screen w-full max-w-[100vw] overflow-x-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
