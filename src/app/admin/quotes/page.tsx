"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

type Quote = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  projectType: string;
  location?: string | null;
  budgetRange?: string | null;
  timeline?: string | null;
  description: string;
  status: string;
  createdAt: string;
};

export default function AdminQuotesPage() {
  const [list, setList] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/quotes", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    await fetch("/api/quotes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status }),
    });
    load();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-primary-600 mb-4">
          <ArrowLeft className="w-4 h-4" /> Admin
        </Link>
        <h1 className="text-2xl font-bold text-construction-dark mb-6">Quote requests</h1>
        {err && <p className="text-red-600 text-sm mb-4">{err}</p>}
        {loading ? (
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        ) : list.length === 0 ? (
          <p className="text-slate-500">No quote requests yet.</p>
        ) : (
          <div className="space-y-4">
            {list.map((q) => (
              <div key={q.id} className="bg-white border rounded-xl p-5 shadow-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold">{q.name}</p>
                    <p className="text-sm text-slate-500">
                      {q.email}
                      {q.phone ? ` · ${q.phone}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100">
                    {q.status}
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  <strong>{q.projectType}</strong>
                  {q.location ? ` · ${q.location}` : ""}
                  {q.budgetRange ? ` · ${q.budgetRange}` : ""}
                </p>
                <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{q.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["NEW", "CONTACTED", "QUOTED", "CLOSED"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(q.id, s)}
                      className="text-xs px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
