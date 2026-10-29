"use client";

import { useState } from "react";
import { Download, Trash2, Loader2, FileText } from "lucide-react";

async function downloadPdf(url: string, fallbackName: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let msg = "Download failed";
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch {
      msg = `Download failed (${res.status})`;
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  if (!blob || blob.size < 50) throw new Error("Empty PDF file");
  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="?([^";]+)"?/i);
  const name = match?.[1] || fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

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

  async function downloadStatement() {
    setBusy("pdf");
    setMsg("");
    try {
      await downloadPdf("/api/history/export", `hama-statement-${Date.now()}.pdf`);
      setMsg("Statement downloaded");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={downloadStatement}
        disabled={!!busy}
        className="inline-flex items-center gap-1.5 text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 rounded-xl"
      >
        {busy === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Download statement (PDF)
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
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function go(url: string, name: string) {
    setBusy(url);
    setMsg("");
    try {
      await downloadPdf(url, name);
      setMsg("Downloaded");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <button
        type="button"
        disabled={!!busy}
        onClick={() => go("/api/admin/export?type=overview", `hama-admin-statement-${Date.now()}.pdf`)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold bg-primary-600 text-white px-3 py-2 rounded-xl"
      >
        {busy.includes("overview") ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Overview statement PDF
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => go("/api/admin/export?type=clients", `hama-clients-${Date.now()}.pdf`)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold border bg-white px-3 py-2 rounded-xl"
      >
        {busy.includes("clients") ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Clients register PDF
      </button>
      {msg && <p className="text-xs text-slate-500 w-full">{msg}</p>}
    </div>
  );
}

export function DownloadUserHistoryButton({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            await downloadPdf(
              `/api/history/export?userId=${encodeURIComponent(userId)}`,
              `hama-client-${userId.slice(0, 8)}.pdf`
            );
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Failed");
          } finally {
            setBusy(false);
          }
        }}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Statement PDF
      </button>
      {err && <span className="text-[10px] text-red-600">{err}</span>}
    </span>
  );
}
