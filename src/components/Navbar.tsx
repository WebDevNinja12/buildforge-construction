"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X, LogIn, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { MaintenanceModal } from "@/components/MaintenanceModal";

interface NavbarProps {
  user?: { name: string; role: string } | null;
}

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintMessage, setMaintMessage] = useState("");

  async function goLogin(e?: React.MouseEvent) {
    e?.preventDefault();
    setMobileOpen(false);
    try {
      const res = await fetch("/api/site-status");
      const d = await res.json().catch(() => ({}));
      if (d?.lockClientLogin || d?.maintenanceMode) {
        setMaintMessage(
          d.message ||
            "Hama Construction is under maintenance. Login is temporarily unavailable."
        );
        setMaintOpen(true);
        return;
      }
    } catch {
      /* allow navigation if status check fails */
    }
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <MaintenanceModal
        open={maintOpen}
        message={maintMessage}
        title="Login unavailable — maintenance"
        onClose={() => setMaintOpen(false)}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-sm group-hover:bg-slate-100 transition-colors">
              <Image
                src="/logo.png"
                alt="Hama Construction"
                width={40}
                height={40}
                className="h-9 w-9 object-contain"
                priority
              />
            </span>
            <span className="text-xl font-bold text-construction-dark tracking-tight">
              Hama <span className="text-sky-500">Construction</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === link.href
                    ? "bg-sky-50 text-sky-700"
                    : "text-slate-600 hover:text-construction-dark hover:bg-slate-100"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center">
            {user ? (
              <Link
                href={user.role === "ADMIN" ? "/admin" : "/dashboard"}
                title="Dashboard"
                aria-label="Dashboard"
                className={cn(
                  "p-2.5 rounded-lg transition-colors",
                  pathname.startsWith("/dashboard") || pathname.startsWith("/admin")
                    ? "bg-sky-50 text-sky-700"
                    : "text-slate-600 hover:text-construction-dark hover:bg-slate-100"
                )}
              >
                <LayoutDashboard className="w-5 h-5" />
              </Link>
            ) : (
              <button
                type="button"
                title="Login"
                aria-label="Login"
                onClick={goLogin}
                className="inline-flex items-center gap-2 min-h-[40px] px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Login
              </button>
            )}
          </div>

          <button
            type="button"
            className="md:hidden text-slate-600 hover:text-construction-dark p-2 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1 border-t border-slate-200 pt-3 bg-white">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-3 py-2.5 rounded-lg text-sm font-medium",
                  pathname === link.href
                    ? "bg-sky-50 text-sky-700"
                    : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <Link
                href={user.role === "ADMIN" ? "/admin" : "/dashboard"}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-sky-600"
              >
                Dashboard
              </Link>
            ) : (
              <button
                type="button"
                onClick={goLogin}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-white bg-sky-500"
              >
                Login
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
