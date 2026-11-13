"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Shield,
  Clock,
  FileCheck2,
} from "lucide-react";

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
  "Under NGN 5,000,000",
  "NGN 5,000,000 – 25,000,000",
  "NGN 25,000,000 – 75,000,000",
  "NGN 75,000,000 – 250,000,000",
  "NGN 250,000,000+",
  "Prefer not to say",
];

const TIMELINES = [
  "As soon as possible",
  "Within 1 month",
  "1 – 3 months",
  "3 – 6 months",
  "6+ months",
  "Flexible / exploring",
];

const STEPS = [
  {
    icon: FileCheck2,
    title: "Share project details",
    body: "Tell us the type of work, location, budget range and timing.",
  },
  {
    icon: Clock,
    title: "We review promptly",
    body: "Our team assesses scope and prepares a clear estimate.",
  },
  {
    icon: Shield,
    title: "Talk through next steps",
    body: "We contact you to refine the quote and discuss delivery.",
  },
];

export default function QuotePage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    projectType: PROJECT_TYPES[0],
    location: "",
    budgetRange: BUDGETS[2],
    timeline: TIMELINES[2],
    description: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [error, setError] = useState("");

  function setField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to submit quote request");
      setStatus("ok");
      setForm({
        name: "",
        email: "",
        phone: "",
        projectType: PROJECT_TYPES[0],
        location: "",
        budgetRange: BUDGETS[2],
        timeline: TIMELINES[2],
        description: "",
      });
    } catch (err) {
      setStatus("err");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const inputClass =
    "w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm min-h-[44px] bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/25 focus:border-primary-400 transition";
  const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5";

  return (
    <div className="bg-slate-50 min-h-screen">
      <section className="relative text-white overflow-hidden min-h-[55vh] sm:min-h-[60vh] flex items-center">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/banners/quote.jpeg')" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-construction-dark/92 via-slate-900/85 to-primary-900/75" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white mb-6 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent-400 mb-3">
              Project enquiry
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
              Request a professional quote
            </h1>
            <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed">
              Share your construction, land, hotel, tools or workforce needs. Hama Construction
              will review and respond with a clear estimate — no obligation.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {STEPS.map((s, i) => (
              <div key={s.title} className="flex gap-3">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Step {i + 1}
                  </p>
                  <p className="font-semibold text-construction-dark text-sm mt-0.5">{s.title}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-10 lg:gap-12 items-start">
            <aside className="lg:col-span-2 space-y-6 order-2 lg:order-1">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="inline-flex items-center gap-2 text-primary-700 mb-3">
                  <ClipboardList className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wide">What to expect</span>
                </div>
                <h2 className="text-lg font-bold text-construction-dark">
                  Building innovation through quality and trust
                </h2>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Quotes cover house and land projects, hotel bookings, tool hire, workers and
                  full project management. Include as much detail as you can for a more accurate
                  response.
                </p>
                <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    Free initial assessment
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    Response during business hours
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    Your details stay confidential
                  </li>
                </ul>
              </div>

              <div className="bg-slate-900 text-white rounded-2xl p-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
                  Prefer to talk?
                </p>
                <div className="space-y-4 text-sm">
                  <Link
                    href="/contact"
                    className="flex items-center gap-3 hover:text-accent-400 transition"
                  >
                    <span className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                      <Phone className="w-4 h-4" />
                    </span>
                    Contact via phone (see Contact page)
                  </Link>
                  <a
                    href="mailto:info@hamaconstruction.ng"
                    className="flex items-center gap-3 hover:text-accent-400 transition"
                  >
                    <span className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </span>
                    info@hamaconstruction.ng
                  </a>
                  <div className="flex items-start gap-3 text-slate-300">
                    <span className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <span>Office details available on our Contact page</span>
                  </div>
                </div>
                <Link
                  href="/contact"
                  className="mt-5 inline-flex text-sm font-semibold text-accent-400 hover:text-accent-300"
                >
                  Go to Contact →
                </Link>
              </div>
            </aside>

            <div className="lg:col-span-3 order-1 lg:order-2">
              {status === "ok" ? (
                <div className="bg-white border border-emerald-200 rounded-2xl p-8 sm:p-10 text-center shadow-sm">
                  <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h2 className="mt-5 text-xl font-bold text-construction-dark">
                    Quote request received
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                    Thank you. Our team will review your project details and contact you using
                    the email or phone you provided.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => setStatus("idle")}
                      className="min-h-[44px] px-5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm transition"
                    >
                      Submit another request
                    </button>
                    <Link
                      href="/services"
                      className="min-h-[44px] inline-flex items-center px-5 rounded-xl border border-slate-200 font-semibold text-sm text-slate-700 hover:bg-slate-50 transition"
                    >
                      Browse services
                    </Link>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={submit}
                  className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                >
                  <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/80">
                    <h2 className="text-lg font-bold text-construction-dark">Project details</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Fields marked required help us respond accurately.
                    </p>
                  </div>

                  <div className="px-6 sm:px-8 py-6 space-y-5">
                    {status === "err" && (
                      <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                        {error}
                      </p>
                    )}

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">
                        Your contact
                      </p>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass} htmlFor="q-name">
                            Full name *
                          </label>
                          <input
                            id="q-name"
                            required
                            value={form.name}
                            onChange={(e) => setField("name", e.target.value)}
                            className={inputClass}
                            placeholder="Your full name"
                            autoComplete="name"
                          />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor="q-phone">
                            Phone *
                          </label>
                          <input
                            id="q-phone"
                            required
                            type="tel"
                            value={form.phone}
                            onChange={(e) => setField("phone", e.target.value)}
                            className={inputClass}
                            placeholder="e.g. 0803…"
                            autoComplete="tel"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelClass} htmlFor="q-email">
                            Email *
                          </label>
                          <input
                            id="q-email"
                            required
                            type="email"
                            value={form.email}
                            onChange={(e) => setField("email", e.target.value)}
                            className={inputClass}
                            placeholder="you@example.com"
                            autoComplete="email"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">
                        Project
                      </p>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass} htmlFor="q-type">
                            Project type *
                          </label>
                          <select
                            id="q-type"
                            required
                            value={form.projectType}
                            onChange={(e) => setField("projectType", e.target.value)}
                            className={inputClass}
                          >
                            {PROJECT_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass} htmlFor="q-location">
                            Location *
                          </label>
                          <input
                            id="q-location"
                            required
                            value={form.location}
                            onChange={(e) => setField("location", e.target.value)}
                            className={inputClass}
                            placeholder="City / area"
                          />
                        </div>
                        <div>
                          <label className={labelClass} htmlFor="q-budget">
                            Budget range
                          </label>
                          <select
                            id="q-budget"
                            value={form.budgetRange}
                            onChange={(e) => setField("budgetRange", e.target.value)}
                            className={inputClass}
                          >
                            {BUDGETS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass} htmlFor="q-timeline">
                            Preferred timeline
                          </label>
                          <select
                            id="q-timeline"
                            value={form.timeline}
                            onChange={(e) => setField("timeline", e.target.value)}
                            className={inputClass}
                          >
                            {TIMELINES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelClass} htmlFor="q-desc">
                            Project description *
                          </label>
                          <textarea
                            id="q-desc"
                            required
                            rows={5}
                            value={form.description}
                            onChange={(e) => setField("description", e.target.value)}
                            className={`${inputClass} min-h-[120px] resize-y`}
                            placeholder="Describe the scope, site conditions, deadlines, and any special requirements…"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 sm:px-8 py-5 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                    <p className="text-xs text-slate-500">
                      By submitting, you agree we may contact you about this enquiry.
                    </p>
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="min-h-[48px] inline-flex items-center justify-center gap-2 px-6 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm disabled:opacity-60 transition shadow-sm"
                    >
                      {status === "loading" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <ClipboardList className="w-4 h-4" />
                          Submit quote request
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
