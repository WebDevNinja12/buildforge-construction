"use client";

import { useState } from "react";
import { Download, Trash2, Loader2, FileText } from "lucide-react";

export function ClientHistoryActions({ onCleared }: { onCleared?: () => void }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function clearHistory() {
    if (
      !confirm(
        "Clear history?\n\n• Notifications will be deleted\n• Completed / cancelled items will be hidden\n• Active reservations stay visible"
      )
    ) {
      return;
    }
    setBusy("clear");
    setMsg("");
    try {
      const res = await fetch("/api/history/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearNotifications: true, hideCompleted: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg(data.message || "Cleared");
      onCleared?.();
      window.location.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  function downloadPdf() {
    setBusy("pdf");
    window.location.href = "/api/history/export";
    setTimeout(() => setBusy(""), 1500);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={downloadPdf}
        disabled={!!busy}
        className="inline-flex items-center gap-1.5 text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 rounded-xl"
      >
        {busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Download PDF
      </button>
      <button
        type="button"
        onClick={clearHistory}
        disabled={!!busy}
        className="inline-flex items-center gap-1.5 text-sm font-semibold border border-red-200 text-red-700 bg-white hover:bg-red-50 px-3 py-2 rounded-xl"
      >
        {busy === "clear" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        Clear history
      </button>
      {msg && <p className="text-xs text-slate-500 w-full">{msg}</p>}
    </div>
  );
}

export function AdminExportButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href="/api/admin/export?type=overview"
        className="inline-flex items-center gap-1.5 text-sm font-semibold bg-primary-600 text-white px-3 py-2 rounded-xl"
      >
        <FileText className="w-4 h-4" /> Overview PDF
      </a>
      <a
        href="/api/admin/export?type=clients"
        className="inline-flex items-center gap-1.5 text-sm font-semibold border bg-white px-3 py-2 rounded-xl"
      >
        <Download className="w-4 h-4" /> Clients PDF
      </a>
    </div>
  );
}

export function DownloadUserHistoryButton({ userId }: { userId: string }) {
  return (
    <a
      href={`/api/history/export?userId=${encodeURIComponent(userId)}`}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
    >
      <Download className="w-3.5 h-3.5" /> PDF
    </a>
  );
}
