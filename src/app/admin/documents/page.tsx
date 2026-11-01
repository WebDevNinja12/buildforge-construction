"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function AdminDocumentsPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/installment-docs", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setDocs(data.documents || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function review(id: string, status: "APPROVED" | "REJECTED") {
    const rejectReason = status === "REJECTED" ? prompt("Reason") || "Rejected" : undefined;
    const res = await fetch("/api/installment-docs/review", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, rejectReason }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setMsg(d.error || "Failed");
      return;
    }
    setMsg(`Marked ${status}`);
    load();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-construction-dark">Documents</h1>
      {msg && <p className="text-sm">{msg}</p>}
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="bg-white border rounded-xl p-3 flex flex-wrap justify-between gap-2 text-sm">
              <div>
                <p className="font-medium">{d.label || d.type}</p>
                <p className="text-xs text-slate-500">{d.status} · user {d.userId}</p>
              </div>
              <div className="flex gap-1">
                {d.fileUrl && (
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline text-primary-600 px-2 py-1">
                    View
                  </a>
                )}
                {d.status !== "APPROVED" && (
                  <button type="button" className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg" onClick={() => review(d.id, "APPROVED")}>
                    Approve
                  </button>
                )}
                {d.status !== "REJECTED" && (
                  <button type="button" className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg" onClick={() => review(d.id, "REJECTED")}>
                    Reject
                  </button>
                )}
              </div>
            </div>
          ))}
          {!docs.length && <p className="text-sm text-slate-500">No installment documents submitted yet.</p>}
        </div>
      )}
    </div>
  );
}
