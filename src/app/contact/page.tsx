"use client";

import { useState } from "react";
import { Phone, Mail, MapPin, Send, CheckCircle2 } from "lucide-react";

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      setStatus("success");
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="bg-white">
      <section className="bg-gradient-to-br from-construction-dark to-primary-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Contact Us</h1>
            <p className="mt-6 text-lg text-slate-300 leading-relaxed">
              Have a question about assets, tools, hiring, or project management?
              We are here to help. Reach out and our team will respond promptly.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-12">
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-construction-dark">Get in Touch</h2>
                <p className="mt-2 text-construction-gray">Prefer to talk? Use any of the channels below.</p>
              </div>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-construction-dark">Office</h3>
                    <p className="text-sm text-construction-gray mt-1">123 Construction Ave<br />Build City, BC 10001</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-construction-dark">Phone</h3>
                    <a href="tel:+1234567890" className="text-sm text-primary-600 hover:underline mt-1 block">+1 (234) 567-890</a>
                    <p className="text-xs text-construction-gray">Mon–Fri, 8am–6pm</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-construction-dark">Email</h3>
                    <a href="mailto:info@buildforge.com" className="text-sm text-primary-600 hover:underline mt-1 block">info@buildforge.com</a>
                    <a href="mailto:support@buildforge.com" className="text-sm text-primary-600 hover:underline block">support@buildforge.com</a>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200">
                {status === "success" ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                    <h3 className="mt-4 text-xl font-semibold text-construction-dark">Message Sent!</h3>
                    <p className="mt-2 text-construction-gray">Thank you for contacting us. We will get back to you soon.</p>
                    <button onClick={() => setStatus("idle")} className="mt-6 text-primary-600 font-medium hover:underline">
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">Full Name *</label>
                        <input id="name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition" placeholder="John Doe" />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
                        <input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition" placeholder="john@example.com" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                        <input id="phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition" placeholder="+1 234 567 890" />
                      </div>
                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1.5">Subject *</label>
                        <input id="subject" type="text" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition" placeholder="Asset inquiry / Tool hire / etc." />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">Message *</label>
                      <textarea id="message" required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition resize-none" placeholder="Tell us about your project or inquiry..." />
                    </div>
                    {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
                    <button type="submit" disabled={status === "loading"}
                      className="inline-flex items-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
                      {status === "loading" ? "Sending..." : (<>Send Message <Send className="w-4 h-4" /></>)}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
