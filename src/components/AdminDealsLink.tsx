"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";

/** Quick link shown near admin tools */
export function AdminDealsLink() {
  return (
    <Link
      href="/admin/deals"
      className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-4 py-2 rounded-xl text-sm"
    >
      <ClipboardList className="w-4 h-4" /> Project deals
    </Link>
  );
}
