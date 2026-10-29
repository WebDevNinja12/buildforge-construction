"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, HardHat, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  user?: { name: string; role: string } | null;
}

/** Public nav only — Profile, Admin, Register live on Dashboard after login */
const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/projects", label: "Projects" },
  { href: "/services", label: "Services" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-construction-dark/95 backdrop-blur-md border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-accent-500 p-1.5 rounded-lg group-hover:bg-accent-400 transition-colors">
              <HardHat className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              Hama <span className="text-accent-500">Construction</span>
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
                    ? "bg-primary-600 text-white"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Login / Logout icon only */}
          <div className="hidden md:flex items-center">
            {user ? (
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  title="Logout"
                  aria-label="Logout"
                  className="p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                title="Login"
                aria-label="Login"
                className="p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
              >
                <LogIn className="w-5 h-5" />
              </Link>
            )}
          </div>

          <button
            className="md:hidden text-slate-300 hover:text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-construction-dark border-t border-slate-700">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-4 py-2.5 rounded-lg text-sm font-medium",
                  pathname === link.href
                    ? "bg-primary-600 text-white"
                    : "text-slate-300 hover:bg-slate-700/50"
                )}
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <form action="/api/auth/logout" method="POST" className="px-2 pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-slate-300 hover:bg-slate-700/50"
              >
                <LogIn className="w-4 h-4" /> Login
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
