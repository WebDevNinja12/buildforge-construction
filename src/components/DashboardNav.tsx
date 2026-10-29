"use client";

import Link from "next/link";
import {
  User,
  LayoutDashboard,
  Shield,
  Building2,
  FileText,
  Settings,
} from "lucide-react";

/** Links that used to sit in the main navbar — only on Dashboard */
export function DashboardNav({
  role,
}: {
  role?: string;
}) {
  const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/profile", label: "My profile", icon: User },
    { href: "/services", label: "Browse services", icon: Building2 },
    { href: "/projects", label: "Finished projects", icon: FileText },
  ];

  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-primary-300 hover:bg-primary-50 text-sm font-medium text-slate-700 px-3 py-2 rounded-xl transition-colors"
        >
          <l.icon className="w-4 h-4 text-primary-600" />
          {l.label}
        </Link>
      ))}
      {role === "ADMIN" && (
        <>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-sm font-medium text-white px-3 py-2 rounded-xl"
          >
            <Shield className="w-4 h-4" /> Admin panel
          </Link>
          <Link
            href="/admin/deals"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-sm font-medium text-white px-3 py-2 rounded-xl"
          >
            <Settings className="w-4 h-4" /> Project deals
          </Link>
        </>
      )}
    </div>
  );
}
