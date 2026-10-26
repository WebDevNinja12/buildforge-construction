"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, HardHat, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  user?: { name: string; role: string } | null;
}

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
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
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <Link href="/dashboard" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white">
                  <User className="w-4 h-4" />
                  {user.name}
                </Link>
                <form action="/api/auth/logout" method="POST">
                  <button type="submit" className="flex items-center gap-1 text-sm text-slate-400 hover:text-accent-400">
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </form>
              </div>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5">
                  Login
                </Link>
                <Link href="/register" className="text-sm font-medium bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded-lg transition-colors">
                  Get Started
                </Link>
              </>
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
            <div className="pt-3 border-t border-slate-700 mt-2">
              {user ? (
                <>
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-sm text-slate-300">
                    Dashboard ({user.name})
                  </Link>
                  <form action="/api/auth/logout" method="POST">
                    <button type="submit" className="w-full text-left px-4 py-2.5 text-sm text-accent-400">
                      Logout
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-sm text-slate-300">
                    Login
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-accent-400">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
