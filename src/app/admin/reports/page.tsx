"use client";

import { AdminExportButtons } from "@/components/HistoryActions";

export default function AdminReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Reports</h1>
      <p className="text-sm text-slate-500">
        Download overview statements and client registers (PDF), same as bank-style history exports.
      </p>
      <div className="bg-white border rounded-2xl p-5">
        <AdminExportButtons />
      </div>
    </div>
  );
}
