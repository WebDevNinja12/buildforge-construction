"use client";

import { AdminToolsClient } from "@/components/AdminToolsClient";

/** Standalone Tools inventory — same UI as Services → Tools hire tab. */
export default function AdminToolsPage() {
  return (
    <div className="space-y-4">
      <AdminToolsClient />
    </div>
  );
}
