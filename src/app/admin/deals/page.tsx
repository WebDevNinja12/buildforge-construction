"use client";

import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { AdminProjectDeals } from "@/components/AdminProjectDeals";

export default function AdminDealsPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="bg-construction-dark text-white py-6">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-accent-400" />
            <div>
              <h1 className="text-xl font-bold">Project deals</h1>
              <p className="text-sm text-slate-300">Review client construction deals · accept or reject</p>
            </div>
          </div>
          <Link href="/admin" className="inline-flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back to Admin
          </Link>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AdminProjectDeals />
      </div>
    </div>
  );
}
