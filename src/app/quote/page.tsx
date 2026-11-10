"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

const PROJECT_TYPES = [
  "New house / building",
  "Hotel / commercial",
  "Land development",
  "Renovation / extension",
  "Tool hire only",
  "Labour / workforce hire",
  "Full project management",
  "Other",
];

const BUDGETS = [
  "Under $10,000",
  "$10,000 – $50,000",
  "$50,000 – $150,000",
  "$150,000 – $500,000",
  "$500,000+",
  "Prefer not to say",
];

export default function QuotePage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    projectType: PROJECT_TYPES[0],
    location: "",
    budgetRange: BUDGETS[2],
    timeline: "",
    description: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus("ok");
      setForm({
        name: "",
        email: "",
        phone: "",
        projectType: PROJECT_TYPES[0],
        location: "",
        budgetRange: BUDGETS[2],
        timeline: "",
        description: "",
      });
    } catch (err) {
      setStatus("err");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <section className="relative text-white py-16 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/banners/quote.jpeg')" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-construction-dark/90 via-slate-900/80 to-primary-900/70" />
        <div className="relative max-w-3xl mx-auto px-4">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-slate-300 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold flex items-center gap-3">
            <ClipboardList className="w-9 h-9 text-accent-500" /> Request a Quote
          </h1>
          <p className="mt-3 text-slate-300">
            Tell us about your project. Hama Construction will review and contact you with an estimate.
          </p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {status === "ok" ? (
          <div className="bg-white border border-green-200 rounded-2xl p-8 text-center shadow-sm">
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
            <h2 className="mt-4 text-xl font-bold text-construction-dark">Request received</h2>
            <p className="mt-2 text-construction-gray">
              Thank you. Our team will get back to you shortly.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <button
                type="button"
                onClick={() => setStatus("idle")}
                className="px-5 py-2.5 rounded-xl bg-primary-600 text-white font-semibold"
              >
                Submit another
              </button>
              <Link href="/services" className="px-5 py-2.5 rounded-xl border font-semibold text-slate-700">
                Browse services
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white border rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
            {status === "err" && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Full name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Project type *</label>
                <select
                  value={form.projectType}
                  onChange={(e) => setForm({ ...form, projectType: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                >
                  {PROJECT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Location / city</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="e.g. Lagos, Abuja"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Budget range</label>
                <select
                  value={form.budgetRange}
                  onChange={(e) => setForm({ ...form, budgetRange: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                >
                  {BUDGETS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Preferred timeline</label>
              <input
                value={form.timeline}
                onChange={(e) => setForm({ ...form, timeline: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="e.g. Start in 3 months"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Project description *</label>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="Scope, size, materials, special requirements"
              />
            </div>
            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full bg-accent-500 hover:bg-accent-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              {status === "loading" ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Submit quote request
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
